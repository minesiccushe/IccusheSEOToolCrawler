import * as cheerio from 'cheerio';

/**
 * XMLサイトマップからURLリストを抽出する
 * @param {string} xmlContent - サイトマップのXML文字列
 * @returns {string[]} URLの配列
 */
export function parseSitemap(xmlContent) {
  if (!xmlContent || typeof xmlContent !== 'string') {
    return [];
  }

  try {
    const $ = cheerio.load(xmlContent, { xmlMode: true });
    const urls = [];
    
    // <loc>タグからURLを抽出
    $('loc').each((_, el) => {
      const url = $(el).text().trim();
      if (url) {
        urls.push(url);
      }
    });
    
    return urls;
  } catch (error) {
    console.error('Sitemap parse error:', error);
    return [];
  }
}
