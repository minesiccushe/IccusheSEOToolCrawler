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

  const metaRobots = getMetaContent('robots');
  const metaRobotsLower = metaRobots.toLowerCase();

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
