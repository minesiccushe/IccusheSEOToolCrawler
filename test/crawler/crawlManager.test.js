import { jest } from '@jest/globals';

// ESモジュールのモック設定
jest.unstable_mockModule('../../src/crawler/fetcher.js', () => ({
  fetchUrl: jest.fn()
}));
jest.unstable_mockModule('../../src/crawler/parser.js', () => ({
  parseHtml: jest.fn(),
  evaluateIndexability: jest.fn()
}));
jest.unstable_mockModule('../../src/crawler/linkExtractor.js', () => ({
  extractLinks: jest.fn()
}));
jest.unstable_mockModule('../../src/crawler/robotsHandler.js', () => ({
  default: {
    getRules: jest.fn().mockResolvedValue({
      evaluate: jest.fn().mockReturnValue({ isAllowed: true, status: 'allowed', directive: '' }),
      getCrawlDelay: jest.fn().mockReturnValue(0),
      getSitemaps: jest.fn().mockReturnValue([])
    })
  }
}));

// モック化後にインポートする
const fetcher = await import('../../src/crawler/fetcher.js');
const parser = await import('../../src/crawler/parser.js');
const linkExtractor = await import('../../src/crawler/linkExtractor.js');
const robotsHandlerModule = await import('../../src/crawler/robotsHandler.js');
const robotsHandler = robotsHandlerModule.default;
const { CrawlManager } = await import('../../src/crawler/crawlManager.js');

describe('CrawlManager のテスト', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  test('単一URLのクロールが成功し、イベントが発火する', async () => {
    const mockHtml = '<html><body>Test</body></html>';
    
    fetcher.fetchUrl.mockResolvedValue({
      success: true, address: 'http://example.com', statusCode: 200, status: 'OK',
      html: mockHtml, size: 10, transferred: 10, totalTransferred: 50, responseTime: 100, contentType: 'text/html'
    });
    
    parser.parseHtml.mockReturnValue({ title: 'Test Title' });
    parser.evaluateIndexability.mockReturnValue({ indexabilityFinal: 'indexable', indexabilityReason: '' });
    linkExtractor.extractLinks.mockReturnValue([]);

    const manager = new CrawlManager({ concurrency: 1, maxUrls: 10, requestDelay: 0 });
    const processedHandler = jest.fn();
    manager.on('url-processed', processedHandler);

    const results = await manager.start('http://example.com');

    expect(results.length).toBe(1);
    expect(results[0].title).toBe('Test Title');
    expect(results[0].address).toBe('http://example.com');
    // メモリ管理チェック（htmlが含まれていないこと）
    expect(results[0].html).toBeUndefined();

    expect(processedHandler).toHaveBeenCalledTimes(1);
    expect(processedHandler.mock.calls[0][0].url).toBe('http://example.com');
  });

  test('抽出されたリンクがキューに追加され、重複排除される', async () => {
    // 1回目のfetchで2つのリンクを返す（1つは重複用）
    fetcher.fetchUrl.mockImplementation(async (url) => {
      return {
        success: true, address: url, statusCode: 200, status: 'OK',
        html: '<html></html>', size: 10, transferred: 10, totalTransferred: 50, responseTime: 100, contentType: 'text/html'
      };
    });
    
    parser.parseHtml.mockReturnValue({});
    parser.evaluateIndexability.mockReturnValue({ indexabilityFinal: 'indexable', indexabilityReason: '' });
    parser.evaluateIndexability.mockReturnValue({ indexabilityFinal: 'indexable', indexabilityReason: '' });
    parser.evaluateIndexability.mockReturnValue({ indexabilityFinal: 'indexable', indexabilityReason: '' });
    
    linkExtractor.extractLinks.mockImplementation((html, url) => {
      if (url === 'http://example.com/1') {
        return ['http://example.com/2', 'http://example.com/3'];
      }
      if (url === 'http://example.com/2') {
        return ['http://example.com/3']; // 重複
      }
      return [];
    });

    const manager = new CrawlManager({ requestDelay: 0 });
    const results = await manager.start('http://example.com/1');

    // /1, /2, /3 の合計3つが処理されるはず
    expect(results.length).toBe(3);
    const urls = results.map(r => r.address);
    expect(urls).toContain('http://example.com/1');
    expect(urls).toContain('http://example.com/2');
    expect(urls).toContain('http://example.com/3');
  });

  test('最大クロール数を超えないこと', async () => {
    fetcher.fetchUrl.mockResolvedValue({
      success: true, address: 'dummy', statusCode: 200, status: 'OK',
      html: '<html></html>', size: 10, transferred: 10, totalTransferred: 50, responseTime: 100, contentType: 'text/html'
    });
    parser.parseHtml.mockReturnValue({});
    parser.evaluateIndexability.mockReturnValue({ indexabilityFinal: 'indexable', indexabilityReason: '' });
    
    // 無限にリンクを返す
    let counter = 0;
    linkExtractor.extractLinks.mockImplementation(() => {
      counter++;
      return [`http://example.com/${counter}`];
    });

    const manager = new CrawlManager({ maxUrls: 5, requestDelay: 0 });
    const results = await manager.start('http://example.com/start');

    expect(results.length).toBe(5);
  });

  test('pause/resume/clearが正しく機能し、イベントが発火する', () => {
    const manager = new CrawlManager({ requestDelay: 0 });
    
    const pauseSpy = jest.spyOn(manager.queue, 'pause');
    const startSpy = jest.spyOn(manager.queue, 'start');
    const clearSpy = jest.spyOn(manager.queue, 'clear');

    const pauseHandler = jest.fn();
    const resumeHandler = jest.fn();
    const stopHandler = jest.fn();

    manager.on('crawl-paused', pauseHandler);
    manager.on('crawl-resumed', resumeHandler);
    manager.on('crawl-stopped', stopHandler);

    manager.pause();
    expect(pauseSpy).toHaveBeenCalled();
    expect(pauseHandler).toHaveBeenCalledTimes(1);

    manager.resume();
    expect(startSpy).toHaveBeenCalled();
    expect(resumeHandler).toHaveBeenCalledTimes(1);

    manager.clear();
    expect(clearSpy).toHaveBeenCalled();
    expect(stopHandler).toHaveBeenCalledTimes(1);
    expect(manager.isRunning).toBe(false);
  });

  test('Listモードではページ内リンクが抽出・追加されないこと', async () => {
    fetcher.fetchUrl.mockResolvedValue({
      success: true, address: 'dummy', statusCode: 200, status: 'OK',
      html: '<html></html>', size: 10, transferred: 10, totalTransferred: 50, responseTime: 100, contentType: 'text/html'
    });
    parser.parseHtml.mockReturnValue({});
    parser.evaluateIndexability.mockReturnValue({ indexabilityFinal: 'indexable', indexabilityReason: '' });
    
    // spiderモードなら抽出されるはずのリンク
    linkExtractor.extractLinks.mockReturnValue(['http://example.com/extracted']);

    const manager = new CrawlManager({ mode: 'list', requestDelay: 0 });
    const results = await manager.start(['http://example.com/1', 'http://example.com/2']);

    // 開始URLのみが処理され、extractedリンクは処理されない
    expect(results.length).toBe(2);
    const urls = results.map(r => r.address);
    expect(urls).toContain('http://example.com/1');
    expect(urls).toContain('http://example.com/2');
    expect(urls).not.toContain('http://example.com/extracted');
  });

  test('robots.txtでブロックされた場合はクロールされずNon-Indexableとなる', async () => {
    robotsHandler.getRules.mockResolvedValueOnce({
      evaluate: jest.fn().mockReturnValue({ isAllowed: false, status: 'disallowed', directive: 'User-agent: * Disallow: /' }),
      getCrawlDelay: jest.fn().mockReturnValue(0),
      getSitemaps: jest.fn().mockReturnValue([])
    }); // 次の1回だけブロック

    const manager = new CrawlManager({ requestDelay: 0 });
    const results = await manager.start('http://example.com/blocked');

    expect(results.length).toBe(1);
    expect(results[0].address).toBe('http://example.com/blocked');
    expect(results[0].status).toBe('Blocked by robots.txt');
    expect(results[0].indexabilityFinal).toBe('non-indexable');
    expect(results[0].indexabilityReason).toBe('robots_txt_block');
    expect(results[0].robotsTxtStatus).toBe('disallowed');
    expect(results[0].robotsTxtDirective).toBe('User-agent: * Disallow: /');
    
    // fetchUrlは呼ばれないはず
    expect(fetcher.fetchUrl).not.toHaveBeenCalledWith('http://example.com/blocked', expect.any(Object));
  });
  test('requestDelay オプションが設定した値で待機されること', async () => {
    fetcher.fetchUrl.mockResolvedValue({
      success: true, address: 'http://example.com', statusCode: 200, status: 'OK',
      html: '<html></html>', size: 10, transferred: 10, totalTransferred: 50, responseTime: 100, contentType: 'text/html'
    });
    parser.parseHtml.mockReturnValue({});
    parser.evaluateIndexability.mockReturnValue({ indexabilityFinal: 'indexable', indexabilityReason: '' });
    linkExtractor.extractLinks.mockReturnValue([]);

    // 50ms のディレイを設定し、実際にその分時間がかかることを確認
    const delay = 50;
    const manager = new CrawlManager({ concurrency: 1, maxUrls: 1, requestDelay: delay });
    
    const startTime = Date.now();
    await manager.start('http://example.com');
    const elapsed = Date.now() - startTime;

    // 設定したディレイ分以上の時間がかかっていること（バッファとして0ms下限で検証）
    expect(elapsed).toBeGreaterThanOrEqual(delay);
    expect(manager.requestDelay).toBe(delay);
  });
});
