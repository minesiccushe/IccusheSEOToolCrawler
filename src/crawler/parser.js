import * as cheerio from 'cheerio';

function normalizeHeadingText(text) {
  if (!text) return '';
  return text
    .replace(/[\r\n\t]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function normalizeType(type) {
  if (!type || typeof type !== 'string') return '';
  // Remove URL parts and prefixes
  let cleaned = type;
  if (cleaned.includes('schema.org/')) {
    cleaned = cleaned.split('schema.org/').pop();
  } else if (cleaned.includes(':')) {
    cleaned = cleaned.split(':').pop();
  } else if (cleaned.includes('/')) {
    cleaned = cleaned.split('/').pop();
  }

  // Convert to PascalCase (just ensure first letter is upper for simple types,
  // schema types are generally already PascalCase once prefix is removed)
  if (cleaned.length > 0) {
    cleaned = cleaned.charAt(0).toUpperCase() + cleaned.slice(1);
  }
  return cleaned.trim();
}

/**
 * Canonical情報を解析する
 * @param {string[]} canonicalHrefs canonicalリンクのhref配列
 * @param {string} currentUrl 現在のURL
 * @returns {Object} 解析結果
 */
function analyzeCanonical(canonicalHrefs, currentUrl) {
  const result = {
    canonicalUrl: '',
    canonicalStatus: 'missing',
    canonicalType: 'empty',
    canonicalSelfReference: false,
    canonicalToOtherDomain: false,
    canonicalMismatch: false,
    canonicalRelative: false,
    canonicalProtocolMismatch: false,
    canonicalParameterMismatch: false,
    canonicalTrailingSlashMismatch: false,
  };

  if (canonicalHrefs.length === 0) {
    return result;
  }

  if (canonicalHrefs.length > 1) {
    result.canonicalStatus = 'multiple';
  } else {
    result.canonicalStatus = 'present';
  }

  const firstHref = canonicalHrefs[0];
  if (!firstHref || firstHref.trim() === '') {
    result.canonicalType = 'empty';
    return result;
  }

  // canonicalRelative: 相対URL判定 (プロトコルから始まらない場合)
  result.canonicalRelative = !/^(https?|ftp):/i.test(firstHref);

  try {
    const canonicalUrlObj = new URL(firstHref, currentUrl);
    const currentUrlObj = new URL(currentUrl);

    result.canonicalUrl = canonicalUrlObj.href;

    // canonicalType
    if (canonicalUrlObj.href === currentUrlObj.href) {
      result.canonicalType = 'self';
      result.canonicalSelfReference = true;
    } else {
      result.canonicalType = 'other';
    }

    // canonicalToOtherDomain
    result.canonicalToOtherDomain = canonicalUrlObj.hostname !== currentUrlObj.hostname;

    // canonicalProtocolMismatch
    result.canonicalProtocolMismatch = canonicalUrlObj.protocol !== currentUrlObj.protocol;

    // canonicalParameterMismatch
    result.canonicalParameterMismatch = canonicalUrlObj.search !== currentUrlObj.search;

    // canonicalTrailingSlashMismatch
    const currentPath = currentUrlObj.pathname;
    const canonicalPath = canonicalUrlObj.pathname;
    const currentHasSlash = currentPath.endsWith('/');
    const canonicalHasSlash = canonicalPath.endsWith('/');
    const normCurrent = currentHasSlash ? currentPath.slice(0, -1) : currentPath;
    const normCanonical = canonicalHasSlash ? canonicalPath.slice(0, -1) : canonicalPath;
    
    if (normCurrent === normCanonical && currentHasSlash !== canonicalHasSlash) {
      result.canonicalTrailingSlashMismatch = true;
    }

    // canonicalMismatch
    if (canonicalUrlObj.href !== currentUrlObj.href) {
      result.canonicalMismatch = true;
    }

  } catch (e) {
    result.canonicalStatus = 'invalid';
    result.canonicalType = 'invalid';
  }

  return result;
}

/**
 * HTML文字列をパースし、必要な抽出項目を取得する
 * @param {string} html パース対象のHTML文字列
 * @returns {Object} 抽出されたデータ
 */
function getDomain(hostname) {
  if (!hostname) return '';
  const parts = hostname.split('.');
  if (parts.length <= 2) return hostname;
  // heuristic: if ends with .co.jp, .com.au, .org.uk etc
  const tld = parts[parts.length - 1];
  const sld = parts[parts.length - 2];
  if (sld.length <= 3 && tld.length <= 2) {
    return parts.slice(-3).join('.');
  }
  return parts.slice(-2).join('.');
}

/**
 * HTML文字列をパースし、必要な抽出項目を取得する
 * @param {string} html パース対象のHTML文字列
 * @param {string} currentUrl 現在のURL
 * @returns {Object} 抽出されたデータ
 */
export function parseHtml(html, currentUrl = '') {
  const $ = cheerio.load(html);

  const getMetaContent = (name) => {
    return $('meta[name="' + name + '" i]').attr('content') || '';
  };

  const getHeading = (tag, index) => {
    const element = $(tag).eq(index);
    return element.length ? element.text().trim() : '';
  };

  const headings = [];
  const headingCounts = { h1: 0, h2: 0, h3: 0, h4: 0, h5: 0, h6: 0 };
  const headingTexts = { h1: [], h2: [], h3: [] };
  let firstH1Text = null;
  let longestHeadingTextLength = 0;
  let emptyHeadingCount = 0;

  $('h1, h2, h3, h4, h5, h6').each((_, el) => {
    const node = $(el);
    const style = node.attr('style') || '';
    if (style.replace(/\s/g, '').toLowerCase().includes('display:none')) return;
    if (node.attr('aria-hidden') === 'true') return;

    let text = '';
    const extractText = (elem) => {
      $(elem).contents().each((_, child) => {
        if (child.type === 'text') {
          text += child.data;
        } else if (child.type === 'tag') {
          if (child.name !== 'script' && child.name !== 'style') {
            extractText(child);
          }
        }
      });
    };
    extractText(el);

    const levelMatch = el.tagName.match(/^h([1-6])$/i);
    if (!levelMatch) return;
    const level = parseInt(levelMatch[1], 10);
    const normalizedText = normalizeHeadingText(text);

    headings.push({ level, text: normalizedText });
    headingCounts[`h${level}`]++;

    if (normalizedText === '' || /^\s*$/.test(text.replace(/[\u200B-\u200D\uFEFF]/g, ''))) {
      emptyHeadingCount++;
    }

    if (normalizedText.length > longestHeadingTextLength) {
      longestHeadingTextLength = normalizedText.length;
    }

    // Capture the first H1 regardless of whether it's empty or not.
    if (level === 1 && firstH1Text === null) {
      firstH1Text = normalizedText;
    }

    if (level >= 1 && level <= 3 && normalizedText !== '') {
      headingTexts[`h${level}`].push(normalizedText);
    }
  });

  let headingOrderValid = true;
  const headingHierarchyIssues = [];
  let previousLevel = null;

  for (const h of headings) {
    if (previousLevel !== null) {
      if (h.level > previousLevel + 1) {
        headingOrderValid = false;
        headingHierarchyIssues.push(`h${previousLevel}→h${h.level}`);
      }
    }
    previousLevel = h.level;
  }

  const metaRobots = getMetaContent('robots');
  const metaRobotsLower = metaRobots.toLowerCase();
  let internalLinkCount = 0;
  let externalLinkCount = 0;
  let internalNofollowCount = 0;
  let externalNofollowCount = 0;
  let selfLinkCount = 0;

  const internalLinkUrlsArr = [];
  const externalLinkUrlsArr = [];
  const internalAnchorTextsArr = [];
  const externalAnchorTextsArr = [];

  let hasBreadcrumbLink = false;
  let linkToTopPage = false;
  let linkDepthEstimate = 0;

  let baseObj = null;
  let baseHostname = '';
  let baseDomain = '';
  let basePathname = '';

  if (currentUrl) {
    try {
      baseObj = new URL(currentUrl);
      baseObj.hash = '';
      baseHostname = baseObj.hostname;
      baseDomain = getDomain(baseHostname);
      basePathname = baseObj.pathname;

      // Calculate linkDepthEstimate
      if (basePathname === '/' || basePathname === '') {
        linkDepthEstimate = 0;
      } else {
        const parts = basePathname.split('/').filter(p => p.length > 0);
        linkDepthEstimate = parts.length;
      }
    } catch (e) {
      // Ignore URL parse error
    }
  }

  // Check breadcrumb
  let hasNavWithMultipleLinks = false;
  $('nav').each((_, nav) => {
    if ($(nav).find('a').length > 1) {
      hasNavWithMultipleLinks = true;
    }
  });

  const hasBreadcrumbClassOrId = $('[class*="breadcrumb" i], [id*="breadcrumb" i]').length > 0;

  let hasBreadcrumbJsonLd = false;
  $('script[type="application/ld+json"]').each((_, script) => {
    try {
      const json = JSON.parse($(script).html() || '{}');
      const checkType = (obj) => {
          if (!obj) return false;
          if (obj['@type'] === 'BreadcrumbList') return true;
          if (Array.isArray(obj)) return obj.some(checkType);
          if (typeof obj === 'object') return Object.values(obj).some(checkType);
          return false;
      };
      if (checkType(json)) hasBreadcrumbJsonLd = true;
    } catch (e) {
    }
  });

  hasBreadcrumbLink = hasNavWithMultipleLinks || hasBreadcrumbClassOrId || hasBreadcrumbJsonLd;

  // Process links
  $('a').each((_, element) => {
    let href = $(element).attr('href');
    if (!href) return;
    href = href.trim();
    if (!href) return;

    if (/^(javascript|mailto|tel|sms|data):/i.test(href)) {
      return;
    }

    // Hash only links are skipped
    if (href.startsWith('#')) {
      return;
    }

    // display:none check (simple inline check)
    const style = $(element).attr('style') || '';
    if (style.replace(/\s/g, '').toLowerCase().includes('display:none')) {
      // Ignore if explicitly display:none inline
      return;
    }

    try {
      const urlObj = new URL(href, currentUrl || 'http://localhost');
      urlObj.hash = ''; // Remove fragment

      const absoluteUrl = urlObj.href;
      const targetHostname = urlObj.hostname;
      const targetDomain = getDomain(targetHostname);

      // Determine if internal
      // 同一ホスト名 → internal
      // サブドメイン：同一扱い（例：www.example.com と example.com は internal）
      const isInternal = baseDomain && targetDomain === baseDomain;
      const isSelf = baseObj && absoluteUrl === baseObj.href;

      const rel = ($(element).attr('rel') || '').toLowerCase();
      const isNofollow = rel.includes('nofollow');

      const anchorText = $(element).text().trim();

      // Top page link check
      if (isInternal && (urlObj.pathname === '/' || urlObj.pathname === '')) {
        linkToTopPage = true;
      }

      if (isSelf) {
        selfLinkCount++;
      }

      if (isInternal) {
        internalLinkCount++;
        internalLinkUrlsArr.push(absoluteUrl);
        if (anchorText) internalAnchorTextsArr.push(anchorText);
        if (isNofollow) internalNofollowCount++;
      } else {
        externalLinkCount++;
        externalLinkUrlsArr.push(absoluteUrl);
        if (anchorText) externalAnchorTextsArr.push(anchorText);
        if (isNofollow) externalNofollowCount++;
      }

    } catch (error) {
      // Invalid URL, ignore
    }
  });

  const internalLinkUniqueCount = new Set(internalLinkUrlsArr).size;
  const externalLinkUniqueCount = new Set(externalLinkUrlsArr).size;
  let structuredDataJsonLdCount = 0;
  let structuredDataInvalidCount = 0;
  const jsonLdTypes = new Set();

  $('script[type="application/ld+json"]').each((_, el) => {
    const text = $(el).text();
    structuredDataJsonLdCount++;
    if (!text || text.trim() === '') {
      structuredDataInvalidCount++;
      return;
    }
    try {
      const parsed = JSON.parse(text);
      const processItem = (item) => {
        if (!item || typeof item !== 'object') return;
        if (Array.isArray(item)) {
          item.forEach(processItem);
        } else if (item['@graph'] && Array.isArray(item['@graph'])) {
          item['@graph'].forEach(processItem);
        } else if (item['@type']) {
          const types = Array.isArray(item['@type']) ? item['@type'] : [item['@type']];
          types.forEach(t => {
            const norm = normalizeType(t);
            if (norm) jsonLdTypes.add(norm);
          });
          // Also process potential nested items
          Object.values(item).forEach(val => {
            if (typeof val === 'object' && val !== null) {
               processItem(val);
            }
          });
        } else {
          // Empty or invalid object without @type
          if (Object.keys(item).length === 0) {
              // we don't count empty objects in nested structure as invalid typically,
              // but if it's the root object, we might.
          }
        }
      };

      if (!parsed || typeof parsed !== 'object' || Object.keys(parsed).length === 0) {
          structuredDataInvalidCount++;
      } else if (!parsed['@type'] && !parsed['@graph'] && !Array.isArray(parsed)) {
          structuredDataInvalidCount++;
      } else {
          processItem(parsed);
      }
    } catch (e) {
      structuredDataInvalidCount++;
    }
  });

  let structuredDataMicrodataCount = 0;
  const microdataTypes = new Set();
  $('[itemscope]').each((_, el) => {
    structuredDataMicrodataCount++;
    const type = $(el).attr('itemtype');
    if (type) {
      const types = type.split(/\s+/);
      types.forEach(t => {
        const norm = normalizeType(t);
        if (norm) microdataTypes.add(norm);
      });
    }
  });

  let structuredDataRdfaCount = 0;
  const rdfaTypes = new Set();
  $('[typeof]').each((_, el) => {
    structuredDataRdfaCount++;
    const type = $(el).attr('typeof');
    if (type) {
      const types = type.split(/\s+/);
      types.forEach(t => {
        const norm = normalizeType(t);
        if (norm) rdfaTypes.add(norm);
      });
    }
  });

  const allTypes = new Set([...jsonLdTypes, ...microdataTypes, ...rdfaTypes]);
  const typesArray = Array.from(allTypes);

  const structuredDataCount = structuredDataJsonLdCount + structuredDataMicrodataCount + structuredDataRdfaCount;
  const structuredDataExists = structuredDataCount > 0;

  let structuredDataPrimaryType = '';
  if (allTypes.has('Product')) structuredDataPrimaryType = 'Product';
  else if (allTypes.has('Article') || allTypes.has('BlogPosting') || allTypes.has('NewsArticle')) structuredDataPrimaryType = 'Article'; // Using generic Article
  else if (allTypes.has('FAQPage')) structuredDataPrimaryType = 'FAQPage';
  else if (allTypes.has('BreadcrumbList')) structuredDataPrimaryType = 'BreadcrumbList';
  else if (allTypes.has('Organization') || allTypes.has('LocalBusiness')) structuredDataPrimaryType = 'Organization'; // Using generic Organization
  else if (typesArray.length > 0) structuredDataPrimaryType = typesArray[0]; // fallback

  const hasBreadcrumbList = allTypes.has('BreadcrumbList');
  const hasFAQ = allTypes.has('FAQPage');
  const hasArticle = allTypes.has('Article') || allTypes.has('BlogPosting') || allTypes.has('NewsArticle');
  const hasProduct = allTypes.has('Product');
  const hasOrganization = allTypes.has('Organization') || allTypes.has('LocalBusiness');

  const extractedData = {
    title: $('title').text().trim(),
    metaDescription: getMetaContent('description'),
    metaKeywords: getMetaContent('keywords'),
    h1_1: getHeading('h1', 0),
    h1_2: getHeading('h1', 1),
    h2_1: getHeading('h2', 0),
    h2_2: getHeading('h2', 1),
    h2_3: getHeading('h2', 2),
    metaRobotsRaw: metaRobots,
    metaRobotsIndex: !metaRobotsLower.includes('noindex'),
    metaRobotsFollow: !metaRobotsLower.includes('nofollow'),
    metaRobots: getMetaContent('robots'),
    internalLinkCount,
    externalLinkCount,
    internalNofollowCount,
    externalNofollowCount,
    internalLinkUrls: internalLinkUrlsArr.join('|'),
    externalLinkUrls: externalLinkUrlsArr.join('|'),
    internalAnchorTexts: internalAnchorTextsArr.join('|'),
    externalAnchorTexts: externalAnchorTextsArr.join('|'),
    internalLinkUniqueCount,
    externalLinkUniqueCount,
    selfLinkCount,
    hasBreadcrumbLink,
    linkToTopPage,
    linkDepthEstimate,

    // Heading Fields
    h1Count: headingCounts.h1,
    h2Count: headingCounts.h2,
    h3Count: headingCounts.h3,
    h4Count: headingCounts.h4,
    h5Count: headingCounts.h5,
    h6Count: headingCounts.h6,
    h1Texts: headingTexts.h1.join('|'),
    h2Texts: headingTexts.h2.join('|'),
    h3Texts: headingTexts.h3.join('|'),
    hasMultipleH1: headingCounts.h1 > 1,
    missingH1: headingCounts.h1 === 0,
    headingOrderValid,
    headingHierarchyIssues: headingHierarchyIssues.join('|'),
    firstH1Text: firstH1Text === null ? '' : firstH1Text,
    longestHeadingTextLength,
    emptyHeadingCount,

    // Structured Data Fields
    structuredDataExists,
    structuredDataCount,
    structuredDataTypes: typesArray.join('|'),
    structuredDataJsonLdCount,
    structuredDataMicrodataCount,
    structuredDataRdfaCount,
    structuredDataInvalidCount,
    structuredDataPrimaryType,
    hasBreadcrumbList,
    hasFAQ,
    hasArticle,
    hasProduct,
    hasOrganization,

    // Canonical Detailed Fields
    ...(() => {
      const canonicalHrefs = [];
      $('link[rel="canonical" i]').each((_, el) => {
        canonicalHrefs.push($(el).attr('href') || '');
      });
      const analysis = analyzeCanonical(canonicalHrefs, currentUrl);
      return {
        ...analysis,
        canonicalLink: canonicalHrefs.length > 0 ? canonicalHrefs[0] : ''
      };
    })()
  };

  // メモリ管理: パース結果オブジェクトのみを返し、元のhtmlや$オブジェクトはスコープ外へ（GC対象とする）
  return extractedData;
}

/**
 * インデックス可能かどうかを判定する
 * @param {number} statusCode HTTPステータスコード
 * @param {Object} parsedData パースされたHTMLデータ
 * @param {string} currentUrl 現在のURL
 * @param {Object} [robotsTxtResult] robots.txtの評価結果 { status }
 * @param {string} [xRobotsTag] X-Robots-Tagの値
 * @returns {Object} { indexabilityFinal, indexabilityReason }
 */
export function evaluateIndexability(statusCode, parsedData, currentUrl, robotsTxtResult = {}, xRobotsTag = '') {
  const reasons = [];

  // 1. HTTPステータス（4xx/5xx）
  if (statusCode >= 500) {
    reasons.push('http_5xx');
  } else if (statusCode >= 400 && statusCode < 500) {
    reasons.push('http_4xx');
  } else if (statusCode !== 200 && statusCode >= 300) {
    // 3xx Redirection etc. We map it to something reasonable, or just follow requirement.
    // The requirement specifically mentions http_4xx and http_5xx, but also old logic caught 3xx. Let's add http_3xx just in case, though prompt says "HTTPステータス（4xx/5xx）".
    reasons.push('http_3xx');
  } else if (statusCode !== 200) {
    reasons.push('http_error');
  }

  // 2. robots.txt
  if (robotsTxtResult.status === 'disallowed') {
    reasons.push('robots_txt_block');
  }

  // 3. X-Robots-Tag
  if (xRobotsTag && /noindex/i.test(xRobotsTag)) {
    reasons.push('x_robots_noindex');
  }

  // 4. meta robots
  if (parsedData.metaRobotsRaw && /noindex/i.test(parsedData.metaRobotsRaw)) {
    reasons.push('meta_noindex');
  }

  // 5. canonical
  if (parsedData.canonicalLink) {
    try {
      const canonicalUrlObj = new URL(parsedData.canonicalLink, currentUrl);
      const currentUrlObj = new URL(currentUrl);
      
      if (canonicalUrlObj.href !== currentUrlObj.href) {
        reasons.push('canonical_to_other');
      }
    } catch (e) {
      // Invalid URLs ignore canonical validation
    }
  }

  if (reasons.length > 0) {
    return { indexabilityFinal: 'non-indexable', indexabilityReason: reasons.join('|') };
  }

  return { indexabilityFinal: 'indexable', indexabilityReason: '' };
}
