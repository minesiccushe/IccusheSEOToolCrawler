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
 * HTML文字列をパースし、必要な抽出項目を取得する
 * @param {string} html パース対象のHTML文字列
 * @returns {Object} 抽出されたデータ
 */
export function parseHtml(html) {
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
    metaRobots: getMetaContent('robots'),
    canonicalLink: $('link[rel="canonical" i]').attr('href') || '',

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
    hasOrganization
  };

  // メモリ管理: パース結果オブジェクトのみを返し、元のhtmlや$オブジェクトはスコープ外へ（GC対象とする）
  return extractedData;
}

/**
 * インデックス可能かどうかを判定する
 * @param {number} statusCode HTTPステータスコード
 * @param {Object} parsedData パースされたHTMLデータ
 * @param {string} currentUrl 現在のURL
 * @returns {Object} { indexability, indexabilityStatus }
 */
export function evaluateIndexability(statusCode, parsedData, currentUrl) {
  if (statusCode >= 500) {
    return { indexability: 'Non-Indexable', indexabilityStatus: 'Server Error' };
  }
  if (statusCode >= 400) {
    return { indexability: 'Non-Indexable', indexabilityStatus: 'Client Error' };
  }
  if (statusCode >= 300) {
    return { indexability: 'Non-Indexable', indexabilityStatus: 'Redirection' };
  }
  if (statusCode !== 200) {
    return { indexability: 'Non-Indexable', indexabilityStatus: 'Error' };
  }

  if (parsedData.metaRobots && /noindex/i.test(parsedData.metaRobots)) {
    return { indexability: 'Non-Indexable', indexabilityStatus: 'noindex' };
  }

  if (parsedData.canonicalLink) {
    try {
      const canonicalUrlObj = new URL(parsedData.canonicalLink, currentUrl);
      const currentUrlObj = new URL(currentUrl);
      
      if (canonicalUrlObj.href !== currentUrlObj.href) {
        return { indexability: 'Non-Indexable', indexabilityStatus: 'Canonicalised' };
      }
    } catch (e) {
      // Invalid URLs ignore canonical validation
    }
  }

  return { indexability: 'Indexable', indexabilityStatus: '' };
}
