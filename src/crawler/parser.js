import * as cheerio from 'cheerio';

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
    return $(`meta[name="${name}" i]`).attr('content') || '';
  };

  const getHeading = (tag, index) => {
    const element = $(tag).eq(index);
    return element.length ? element.text().trim() : '';
  };

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
    linkDepthEstimate
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
