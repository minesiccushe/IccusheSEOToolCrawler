import { jest } from '@jest/globals';

// ESモジュールのモック設定
jest.unstable_mockModule('../../src/crawler/fetcher.js', () => ({
  fetchUrl: jest.fn()
}));
jest.unstable_mockModule('../../src/crawler/robotsHandler.js', () => ({
  default: {
    evaluate: jest.fn().mockResolvedValue({ isAllowed: true, status: 'allowed', directive: '' }),
    getCrawlDelay: jest.fn().mockResolvedValue(0),
    getSitemaps: jest.fn().mockResolvedValue([])
  }
}));

const fetcher = await import('../../src/crawler/fetcher.js');
const { CrawlManager } = await import('../../src/crawler/crawlManager.js');

describe('CrawlManager 大規模テスト', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  test('1000ページの模擬クロールがメモリリークなく完了すること', async () => {
    // タイムアウトを延長
    jest.setTimeout(30000);

    const maxPages = 1000;
    
    // fetchUrlをモックし、各ページから2つの新しいリンクを生成する（最大1000まで）
    fetcher.fetchUrl.mockImplementation(async (url) => {
      // 擬似的なネットワーク遅延
      await new Promise(resolve => setTimeout(resolve, 2));
      
      const urlId = url === 'http://example.com/start' ? 1 : parseInt(url.split('/').pop(), 10);
      const next1 = urlId * 2;
      const next2 = urlId * 2 + 1;
      
      let html = '<html><body>';
      if (next1 <= maxPages) html += `<a href="http://example.com/${next1}">Link ${next1}</a>`;
      if (next2 <= maxPages) html += `<a href="http://example.com/${next2}">Link ${next2}</a>`;
      html += '</body></html>';

      return {
        success: true, address: url, statusCode: 200, status: 'OK',
        html, size: 100, transferred: 100, totalTransferred: 150, responseTime: 10, contentType: 'text/html'
      };
    });

    const manager = new CrawlManager({ concurrency: 10, maxUrls: 2000, requestDelay: 0 }); // テスト: 遅延なし
    
    // イベント発火回数の確認用
    let processedCount = 0;
    manager.on('url-processed', () => {
      processedCount++;
    });

    const startMemory = process.memoryUsage().heapUsed;
    
    const results = await manager.start('http://example.com/start');
    
    const endMemory = process.memoryUsage().heapUsed;
    const memoryDiffMB = (endMemory - startMemory) / 1024 / 1024;

    expect(results.length).toBe(maxPages);
    expect(processedCount).toBe(maxPages);
    
    // メモリ増加量が一定（例えば100MB）以下であること（1000件のresultsオブジェクトのメモリ増加）
    // 実際にhtmlを保持していると数百MBになる可能性があるが、破棄していれば数MBで収まるはず
    expect(memoryDiffMB).toBeLessThan(50);
  });
});
