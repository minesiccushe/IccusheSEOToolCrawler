/**
 * HTMLからURLを抽出し、正規化とフィルタリングを行うモジュール
 */
import * as cheerio from 'cheerio';

/**
 * HTML文字列からリンクを抽出し、同一ホストの絶対URLの配列を返す
 * @param {string} html - パース対象のHTML文字列
 * @param {string} baseUrl - 抽出元ページのURL（相対パスの解決や同一ホスト判定に使用）
 * @returns {string[]} 抽出されたURLの配列
 */
export function extractLinks(html, baseUrl) {
  const links = [];
  let baseObj;
  
  try {
    baseObj = new URL(baseUrl);
  } catch (e) {
    // baseUrlが不正な場合は空配列を返す
    return links;
  }

  const baseHostname = baseObj.hostname;
  // HTML文字列をここでパース（crawlManager側での二重ロードを防ぐ）
  const $ = cheerio.load(html);

  $('a').each((_, element) => {
    let href = $(element).attr('href');
    if (!href) return;
    
    href = href.trim();
    if (!href) return;

    // javascript:, mailto:, tel: などの不要なスキームを除外
    if (/^(javascript|mailto|tel|sms|data):/i.test(href)) {
      return;
    }

    try {
      // 相対パスを絶対URLに変換
      let urlObj = new URL(href, baseUrl);

      // 相対パス（または同一ホストでの絶対パス）の場合は、抽出元のスキーマ（プロトコル）を強制的に引き継ぐ
      // これにより、http/httpsの混在による重複を防止する
      if (urlObj.hostname === baseObj.hostname) {
        urlObj.protocol = baseObj.protocol;
      }
      
      // 同一ホスト名のみを対象とする
      if (urlObj.hostname !== baseHostname) {
        return;
      }
      
      // ハッシュ（#）を削除してURLを正規化
      urlObj.hash = '';
      
      links.push(urlObj.href);
    } catch (error) {
      // URLのパースに失敗した場合は無視
    }
  });

  return links;
}
