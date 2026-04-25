import * as cheerio from 'cheerio';

/**
 * HTML文字列をパースし、必要な抽出項目を取得する
 * @param {string} html パース対象のHTML文字列
 * @returns {Object} 抽出されたデータ
 */
export function parseHtml(html) {
  const $ = cheerio.load(html);

  const getMetaContent = (name) => {
    return $(`meta[name="${name}" i]`).attr('content') || '';
  };

  const getHeading = (tag, index) => {
    const element = $(tag).eq(index);
    return element.length ? element.text().trim() : '';
  };

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
    canonicalLink: $('link[rel="canonical" i]').attr('href') || ''
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
