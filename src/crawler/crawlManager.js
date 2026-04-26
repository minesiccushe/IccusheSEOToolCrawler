import { EventEmitter } from 'events';
import PQueue from 'p-queue';
import { fetchUrl } from './fetcher.js';
import { parseHtml, evaluateIndexability } from './parser.js';
import { extractLinks } from './linkExtractor.js';
import { parseSitemap } from '../utils/sitemapParser.js';
import robotsHandler from './robotsHandler.js';

export class CrawlManager extends EventEmitter {
  constructor(options = {}) {
    super();
    this.concurrency = options.concurrency || 2; // 作法：並列数は控えめに（旧5）
    this.maxUrls = options.maxUrls || 10000;
    this.mode = options.mode || 'spider'; // 'spider' or 'list'
    this.auth = options.auth || null;
    this.userAgent = options.userAgent || 'IccusheSEOToolCrawler/1.0';
    // リクエスト間の最小待機時間（ms）。作法：デフォルト1000ms（旧100ms）
    this.requestDelay = options.requestDelay !== undefined ? options.requestDelay : 1000;
    this.queue = new PQueue({ concurrency: this.concurrency });
    this.visited = new Set();
    this.lastRequestTimes = new Map(); // ドメインごとの最終リクエスト時刻管理
    this.results = [];
    this.isRunning = false;
    this.baseUrl = '';
  }

  setConcurrency(concurrency) {
    this.concurrency = concurrency;
    this.queue.concurrency = concurrency;
  }

  async start(startUrls) {
    const urls = Array.isArray(startUrls) ? startUrls : [startUrls];
    this.baseUrl = urls.length > 0 ? urls[0] : '';
    this.visited.clear();
    this.lastRequestTimes.clear();
    this.results = [];
    this.isRunning = true;
    this.queue.clear();
    
    for (const url of urls) {
      this.enqueue(url);
    }

    // キューが空になるまで待つ
    await this.queue.onIdle();

    this.isRunning = false;
    this.emit('crawl-complete', this.results);
    return this.results;
  }

  pause() {
    this.queue.pause();
    this.emit('crawl-paused');
  }

  resume() {
    this.queue.start();
    this.emit('crawl-resumed');
  }

  clear() {
    this.queue.clear();
    this.isRunning = false;
    this.emit('crawl-stopped');
  }

  enqueue(url) {
    if (!this.isRunning || this.visited.has(url) || this.visited.size >= this.maxUrls) {
      return;
    }

    this.visited.add(url);

    this.queue.add(async () => {
      if (!this.isRunning) return;

      try {
        const urlObj = new URL(url);
        const origin = urlObj.origin;

        // 取得したURLに対するrobots.txtのルールを一括取得（パフォーマンス改善）
        const robotsRules = await robotsHandler.getRules(url, this.auth);

        // 初めてのドメインの場合、Sitemapの自動検出を試みる（Spiderモードのみ）
        if (this.mode === 'spider' && !this.lastRequestTimes.has(origin)) {
          const sitemapUrls = robotsRules.getSitemaps();
          for (const sitemapUrl of sitemapUrls) {
            // サイトマップ自体の処理もキューに追加する
            this.queue.add(() => this.processSitemap(sitemapUrl));
          }
        }

        // robots.txt の許可チェックと Crawl-delay の取得
        const robotsResult = robotsRules.evaluate(this.userAgent);
        const isAllowed = robotsResult.isAllowed;
        const robotsDelay = robotsRules.getCrawlDelay(this.userAgent);

        // 1. robots.txt の Crawl-delay を尊重するためのドメイン単位インターバル待機
        const lastTime = this.lastRequestTimes.get(origin) || 0;
        const now = Date.now();
        const intervalWaitTime = Math.max(0, robotsDelay - (now - lastTime));
        
        if (intervalWaitTime > 0) {
          await new Promise(resolve => setTimeout(resolve, intervalWaitTime));
        }

        // 2. 一律のリクエスト間ディレイ（RULE.md §7 準拠 & テスト互換性維持）
        // robots.txtの指定がない場合でも、最低限 this.requestDelay 分は待機する
        if (this.requestDelay > 0) {
          await new Promise(resolve => setTimeout(resolve, this.requestDelay));
        }
        
        // 最終リクエスト時刻を更新（リクエスト開始直前に設定）
        this.lastRequestTimes.set(origin, Date.now());
        
        if (!isAllowed) {
          const rowData = {
            address: url,
            contentType: '',
            statusCode: 0,
            status: 'Blocked by robots.txt',
            size: 0,
            transferred: 0,
            totalTransferred: 0,
            responseTime: 0,
            xRobotsTag: '',
            robotsTxtStatus: robotsResult.status,
            robotsTxtDirective: robotsResult.directive,
            metaRobotsIndex: true,
            metaRobotsFollow: true,
            metaRobotsRaw: '',
            indexabilityFinal: 'non-indexable',
            indexabilityReason: 'robots_txt_block'
          };
          this.results.push(rowData);
          this.emit('url-processed', {
            url,
            result: rowData,
            visitedCount: this.visited.size,
            queueCount: this.queue.size,
            pendingCount: this.queue.pending
          });
          return;
        }

        const fetchResult = await fetchUrl(url, this.auth);
        
        let rowData = {
          address: url,
          contentType: fetchResult.contentType,
          statusCode: fetchResult.statusCode,
          status: fetchResult.status,
          size: fetchResult.size,
          transferred: fetchResult.transferred,
          totalTransferred: fetchResult.totalTransferred,
          responseTime: fetchResult.responseTime,
          xRobotsTag: fetchResult.xRobotsTag || '',
          robotsTxtStatus: robotsResult.status,
          robotsTxtDirective: robotsResult.directive,
          metaRobotsIndex: true,
          metaRobotsFollow: true,
          metaRobotsRaw: '',
          indexabilityFinal: 'indexable',
          indexabilityReason: ''
        };

        if (fetchResult.success && fetchResult.html) {
          // HTMLのパース
          const parsedData = parseHtml(fetchResult.html, url);
          
          // Indexabilityの評価
          const indexabilityResult = evaluateIndexability(
            fetchResult.statusCode, parsedData, url, robotsResult, fetchResult.xRobotsTag
          );
          
          Object.assign(rowData, parsedData, indexabilityResult);

          // リンクの抽出とキュー追加（Spiderモードの場合のみ）
          if (this.mode === 'spider') {
            const newLinks = extractLinks(fetchResult.html, url);
            for (const link of newLinks) {
              this.enqueue(link);
            }
          }
        } else {
          // fetch失敗時などのIndexability
          const indexabilityResult = evaluateIndexability(
            fetchResult.statusCode, {}, url, robotsResult, fetchResult.xRobotsTag
          );
          Object.assign(rowData, indexabilityResult);
        }

        // T-3.5: メモリ管理（htmlを保存しない）
        // rowDataにはhtmlプロパティが含まれていないため、これのみ保持すればhtmlはGCされる
        
        this.results.push(rowData);
        
        this.emit('url-processed', {
          url,
          result: rowData,
          visitedCount: this.visited.size,
          queueCount: this.queue.size,
          pendingCount: this.queue.pending
        });

      } catch (error) {
        this.emit('crawl-error', { url, error: error.message });
      }
    });
  }

  /**
   * Sitemap URL を取得してパースし、含まれる URL をキューに追加する
   * @param {string} sitemapUrl 
   */
  async processSitemap(sitemapUrl) {
    // すでに訪問済み（HTMLとして処理済み）ならスキップ
    if (this.visited.has(sitemapUrl)) return;
    
    try {
      const fetchResult = await fetchUrl(sitemapUrl, this.auth);
      if (fetchResult.success && fetchResult.html) {
        const urls = parseSitemap(fetchResult.html);
        for (const url of urls) {
          this.enqueue(url);
        }
      }
    } catch (error) {
      console.error(`Failed to process sitemap ${sitemapUrl}:`, error.message);
    }
  }
}
