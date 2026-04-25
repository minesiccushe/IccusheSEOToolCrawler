import axios from 'axios';
import robotsParser from 'robots-parser';

class RobotsHandler {
  constructor() {
    this.cache = new Map();
  }

  /**
   * 指定されたURLのオリジンから robots.txt を取得し、パースする
   * キャッシュがあればそれを返す
   * @param {string} url - チェック対象のURL
   * @param {Object} [auth=null] - { username, password } 形式のBasic認証情報
   * @returns {Promise<Object>} robots-parserのインスタンス、取得失敗時はnull
   */
  async getRobotsTxt(url, auth = null) {
    try {
      const targetUrl = new URL(url);
      const origin = targetUrl.origin;
      const robotsUrl = `${origin}/robots.txt`;

      if (this.cache.has(origin)) {
        return this.cache.get(origin);
      }

      const requestOptions = {
        timeout: 10000,
        validateStatus: () => true // 404等でも例外を投げない
      };

      if (auth && auth.username && auth.password) {
        requestOptions.auth = auth;
      }

      const response = await axios.get(robotsUrl, requestOptions);

      let parser = null;
      // 200 OKの場合のみパースする
      if (response.status === 200 && response.data) {
        const content = typeof response.data === 'string' ? response.data : String(response.data);
        parser = robotsParser(robotsUrl, content);
      }
      
      this.cache.set(origin, parser);
      return parser;
    } catch (error) {
      console.error(`Failed to fetch robots.txt for ${url}:`, error.message);
      // エラー時はnullを返し、デフォルト許可とする。エラー状態のキャッシュは状況に応じて検討するが、今回はシンプルにnullをキャッシュしないでおくか、あるいはエラーもキャッシュするか。
      // パフォーマンスを考慮し、エラー（不正URL等）の場合もnullとしてキャッシュする。
      try {
         const origin = new URL(url).origin;
         this.cache.set(origin, null);
      } catch (e) {
         // 無効なURLの場合
      }
      return null;
    }
  }

  /**
   * 指定したURLが特定のUser-Agentでクロール許可されているかチェックする
   * @param {string} url - チェック対象のURL
   * @param {string} userAgent - クローラーのUser-Agent
   * @param {Object} [auth=null] - { username, password } 形式のBasic認証情報
   * @returns {Promise<boolean>} 許可されていればtrue、拒否されていればfalse (取得失敗や404はtrueを返す)
   */
  async isAllowed(url, userAgent = '*', auth = null) {
    try {
      // URLの妥当性チェック
      new URL(url);
    } catch (e) {
      return false; // 無効なURLはクロール不可とする
    }

    const parser = await this.getRobotsTxt(url, auth);
    if (!parser) {
      return true; // robots.txtが存在しない、または取得失敗した場合はデフォルトで許可
    }

    const allowed = parser.isAllowed(url, userAgent);
    // undefined の場合も許可とみなす
    return allowed !== false;
  }

  /**
   * 指定したURLのUser-Agentに対する Crawl-delay をミリ秒単位で取得する
   * @param {string} url - 対象URL
   * @param {string} userAgent - クローラーのUser-Agent
   * @param {Object} [auth=null] - 認証情報
   * @returns {Promise<number>} ディレイ（ms）。設定がない場合は0
   */
  async getCrawlDelay(url, userAgent = '*', auth = null) {
    const parser = await this.getRobotsTxt(url, auth);
    if (!parser) {
      return 0;
    }
    const delay = parser.getCrawlDelay(userAgent);
    // robots-parser は秒単位で返すため、1000倍してミリ秒にする
    return delay ? delay * 1000 : 0;
  }

  /**
   * 指定したURLのオリジンにおける Sitemap URL のリストを取得する
   * @param {string} url - 対象URL
   * @param {Object} [auth=null] - 認証情報
   * @returns {Promise<string[]>} Sitemap URLの配列
   */
  async getSitemaps(url, auth = null) {
    const parser = await this.getRobotsTxt(url, auth);
    if (!parser) {
      return [];
    }
    return parser.getSitemaps();
  }

  /**
   * キャッシュをクリアする
   */
  clearCache() {
    this.cache.clear();
  }
}

export default new RobotsHandler();
