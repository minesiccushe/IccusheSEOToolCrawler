import { fetchUrl } from './fetcher.js';
import * as cheerio from 'cheerio';

/**
 * Canonicalの連鎖を追跡する
 * @param {string} startUrl 開始URL（調査対象のページ）
 * @param {string} firstCanonical 調査対象ページで最初に見つかったCanonical URL
 * @param {Object} auth 認証情報
 * @returns {Promise<Object>} チェーン追跡結果
 */
export async function traceCanonicalChain(startUrl, firstCanonical, auth = null) {
  const chain = [startUrl];
  const visited = new Set([startUrl]);
  let nextCanonicalCandidate = firstCanonical;
  let loopFlag = false;

  // 最大5ホップまで追跡（RULE.md 準拠）
  const maxHops = 5;
  
  for (let i = 0; i < maxHops; i++) {
    if (!nextCanonicalCandidate || nextCanonicalCandidate.trim() === '') {
      break;
    }

    try {
      const prevUrl = chain[chain.length - 1];
      const normCanonical = new URL(nextCanonicalCandidate, prevUrl).href;

      // ループ検知
      if (visited.has(normCanonical)) {
        loopFlag = true;
        chain.push(normCanonical);
        break;
      }

      chain.push(normCanonical);
      visited.add(normCanonical);

      // 次のURLをフェッチしてCanonicalを取得
      const fetchResult = await fetchUrl(normCanonical, auth);
      if (!fetchResult.success || !fetchResult.html) {
        // フェッチ失敗、またはHTMLが取得できない場合はそこで追跡終了
        break;
      }

      const $ = cheerio.load(fetchResult.html);
      const nextCanonical = $('link[rel="canonical" i]').attr('href') || null;
      
      // HTMLパース後のメモリ解放（cheerioの$を破棄しやすくするため null 代入）
      // ただし Node.js では変数のスコープ終了でGC対象となるため、ここでは代入のみ
      nextCanonicalCandidate = nextCanonical;

    } catch (e) {
      // URLエラーなどで追跡不能な場合は終了
      break;
    }
  }

  return {
    canonicalChain: chain.join('|'),
    canonicalChainLength: chain.length,
    canonicalLoopFlag: loopFlag
  };
}
