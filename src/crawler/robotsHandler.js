import axios from 'axios';
import robotsParser from 'robots-parser';

class RobotsHandler {
  constructor() {
    this.cache = new Map();
  }

  /**
   * robots.txt の取得状況を把握するためのヘルパー
   * @param {string} url
   * @returns {string} status ('allowed' | 'disallowed' | 'unknown' | 'error') -> Note: this will be evaluated per URL later, but we need to track if fetching failed.
   */
  getCacheStatus(url) {
      try {
          const origin = new URL(url).origin;
          if (this.cache.has(origin)) {
              return this.cache.get(origin) === null ? 'error' : 'fetched';
          }
      } catch (e) {}
      return 'unknown';
  }

  /**
   * 指定されたURLのオリジンから robots.txt を取得し、パースする
   * キャッシュがあればそれを返す
   * @param {string} url - チェック対象のURL
   * @param {Object} [auth=null] - { username, password } 形式のBasic認証情報
   * @returns {Promise<Object>} robots-parserのインスタンス、取得失敗時はnull
   */
  async getRobotsTxt(url, auth = null) {
    let origin = null;
    try {
      const targetUrl = url instanceof URL ? url : new URL(url);
      origin = targetUrl.origin;
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
      const urlStr = url instanceof URL ? url.href : url;
      console.error(`Failed to fetch robots.txt for ${urlStr}:`, error.message);
      // エラー時はnullを返し、デフォルト許可とする。エラー状態のキャッシュは状況に応じて検討するが、今回はシンプルにnullをキャッシュしないでおくか、あるいはエラーもキャッシュするか。
      // パフォーマンスを考慮し、エラー（不正URL等）の場合もnullとしてキャッシュする。
      if (origin) {
        this.cache.set(origin, null);
      }
      return null;
    }
  }

  /**
   * 指定したURLに適用されるディレクティブ文字列を取得する
   * @param {string} url - チェック対象のURL
   * @param {Array<string>} userAgents - 評価するUser-Agentの配列（例: ['*', 'Googlebot']）
   * @param {Object} [auth=null] - 認証情報
   * @returns {Promise<string>} 該当するディレクティブ（複数ある場合は ; 区切り）
   */
  async getRobotsDirective(url, userAgents = ['*', 'Googlebot'], auth = null) {
    const parser = await this.getRobotsTxt(url, auth);
    if (!parser) return '';

    const directives = [];
    for (const ua of userAgents) {
      const lineNum = parser.getMatchingLineNumber(url, ua);
      if (lineNum !== undefined && lineNum > 0) {
        const uaKey = ua.toLowerCase();
        const rules = parser._rules[uaKey] || parser._rules['*'];
        if (rules) {
          for (const rule of rules) {
            if (rule.lineNumber === lineNum) {
              const dirType = rule.allow ? 'Allow' : 'Disallow';
              directives.push(`User-agent: ${ua} ${dirType}: ${rule.pattern}`);
            }
          }
        }
      }
    }
    return directives.join('; ');
  }

  /**
   * 指定したURLのrobots.txt評価結果（status, directive）を取得する
   * @param {string} url - チェック対象のURL
   * @param {string} userAgent - クローラーのUser-Agent
   * @param {Object} [auth=null] - 認証情報
   * @returns {Promise<Object>} { isAllowed: boolean, status: string, directive: string }
   */
  async evaluate(url, userAgent = '*', auth = null) {
      let isAllowed = true;
      let status = 'unknown';
      let directive = '';

      let parsedUrl;
      try {
          parsedUrl = new URL(url);
      } catch (e) {
          return { isAllowed: false, status: 'error', directive: '' };
      }

      // Check cache status before fetch to know if it's unknown vs error
      const preFetchStatus = this.getCacheStatus(parsedUrl);
      const parser = await this.getRobotsTxt(parsedUrl, auth);

      if (!parser) {
          // If parser is null, it means there was an error fetching or it's a 4xx/5xx for robots.txt
          // Assuming error means we default to allow, but status is 'error' or 'unknown'
          // We set it to 'error' if cache contains null (which means we tried and failed), or if it's 404 it might be 'allowed' default but no robots.txt.
          // Wait, the prompt says: "robots.txtでクロール許可 → allowed, ブロック → disallowed, 未取得 → unknown, 取得エラー → error"
          // If we couldn't fetch robots.txt, we assume 'error'. If it was 404, we treat it as allowed but what status?
          // Let's rely on cache value. If cache is null, error.
          // We don't have a specific way to distinguish 404 from 500 error in `getRobotsTxt` without modifying it.
          // But null in cache means it threw an error (like 500 or timeout), while 200 parses.
          // Let's refine how we set status when parser is null.
          status = this.getCacheStatus(parsedUrl) === 'error' ? 'error' : 'unknown';
          return { isAllowed: true, status, directive: '' };
      }

      const allowed = parser.isAllowed(url, userAgent);
      isAllowed = allowed !== false;
      status = isAllowed ? 'allowed' : 'disallowed';

      // prompt specifies checking both * and Googlebot
      directive = await this.getRobotsDirective(parsedUrl, ['*', 'Googlebot'], auth);

      return { isAllowed, status, directive };
  }

  /**
   * 指定したURLが特定のUser-Agentでクロール許可されているかチェックする
   * @param {string} url - チェック対象のURL
   * @param {string} userAgent - クローラーのUser-Agent
   * @param {Object} [auth=null] - { username, password } 形式のBasic認証情報
   * @returns {Promise<boolean>} 許可されていればtrue、拒否されていればfalse (取得失敗や404はtrueを返す)
   */
  async isAllowed(url, userAgent = '*', auth = null) {
    let parsedUrl;
    try {
      // URLの妥当性チェック
      parsedUrl = new URL(url);
    } catch (e) {
      return false; // 無効なURLはクロール不可とする
    }

    const parser = await this.getRobotsTxt(parsedUrl, auth);
    if (!parser) {
      return true; // robots.txtが存在しない、または取得失敗した場合はデフォルトで許可
    }

    const allowed = parser.isAllowed(parsedUrl.href, userAgent);
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
   * 単一のURLに対するrobots.txtのルール一式を返す。
   * これにより、複数メソッド（evaluate, getCrawlDelay, getSitemaps）呼び出し時の
   * URLパースやキャッシュ参照の重複を防ぎ、パフォーマンスを向上させる。
   * @param {string} url - チェック対象のURL
   * @param {Object} [auth=null] - 認証情報
   * @returns {Promise<Object>} urlに対するルール評価オブジェクト
   */

  /**
   * 単一のオリジンに対するrobots.txtのルール一式を返す。
   * @param {string} origin - チェック対象のオリジン
   * @param {Object} [auth=null] - 認証情報
   * @returns {Promise<Object>} originに対するルール評価オブジェクト
   */
  async getOriginRules(origin, auth = null) {
    let isInvalidUrl = false;
    try {
      new URL(origin);
    } catch (e) {
      isInvalidUrl = true;
    }

    const cacheStatus = isInvalidUrl ? 'error' : this.getCacheStatus(origin);
    const parser = isInvalidUrl ? null : await this.getRobotsTxt(origin, auth);

    return {
      isAllowed: (targetUrl, userAgent = '*') => {
        if (isInvalidUrl) return false;
        if (!parser) return true;
        return parser.isAllowed(targetUrl, userAgent) !== false;
      },
      evaluate: (targetUrl, userAgent = '*') => {
        if (isInvalidUrl) return { isAllowed: false, status: 'error', directive: '' };

        let isAllowed = true;
        let status = 'unknown';
        let directive = '';

        if (!parser) {
          status = cacheStatus === 'error' ? 'error' : 'unknown';
          return { isAllowed: true, status, directive: '' };
        }

        const allowed = parser.isAllowed(targetUrl, userAgent);
        isAllowed = allowed !== false;
        status = isAllowed ? 'allowed' : 'disallowed';

        const directives = [];
        for (const ua of ['*', 'Googlebot']) {
          const lineNum = parser.getMatchingLineNumber(targetUrl, ua);
          if (lineNum !== undefined && lineNum > 0) {
            const uaKey = ua.toLowerCase();
            const rules = parser._rules[uaKey] || parser._rules['*'];
            if (rules) {
              for (const rule of rules) {
                if (rule.lineNumber === lineNum) {
                  const dirType = rule.allow ? 'Allow' : 'Disallow';
                  directives.push(`User-agent: ${ua} ${dirType}: ${rule.pattern}`);
                }
              }
            }
          }
        }
        directive = directives.join('; ');

        return { isAllowed, status, directive };
      },
      getCrawlDelay: (userAgent = '*') => {
        if (!parser) return 0;
        const delay = parser.getCrawlDelay(userAgent);
        return delay ? delay * 1000 : 0;
      },
      getSitemaps: () => {
        if (!parser) return [];
        return parser.getSitemaps();
      }
    };
  }

  async getRules(url, auth = null) {
    let isInvalidUrl = false;
    try {
      new URL(url);
    } catch (e) {
      isInvalidUrl = true;
    }

    // preFetchStatus evaluation logic mirrors what was in evaluate()
    const cacheStatus = isInvalidUrl ? 'error' : this.getCacheStatus(url);
    const parser = isInvalidUrl ? null : await this.getRobotsTxt(url, auth);

    return {
      isAllowed: (userAgent = '*') => {
        if (isInvalidUrl) return false;
        if (!parser) return true;
        return parser.isAllowed(url, userAgent) !== false;
      },
      evaluate: (userAgent = '*') => {
        if (isInvalidUrl) return { isAllowed: false, status: 'error', directive: '' };

        let isAllowed = true;
        let status = 'unknown';
        let directive = '';

        if (!parser) {
          status = cacheStatus === 'error' ? 'error' : 'unknown';
          return { isAllowed: true, status, directive: '' };
        }

        const allowed = parser.isAllowed(url, userAgent);
        isAllowed = allowed !== false;
        status = isAllowed ? 'allowed' : 'disallowed';

        const directives = [];
        for (const ua of ['*', 'Googlebot']) {
          const lineNum = parser.getMatchingLineNumber(url, ua);
          if (lineNum !== undefined && lineNum > 0) {
            const uaKey = ua.toLowerCase();
            const rules = parser._rules[uaKey] || parser._rules['*'];
            if (rules) {
              for (const rule of rules) {
                if (rule.lineNumber === lineNum) {
                  const dirType = rule.allow ? 'Allow' : 'Disallow';
                  directives.push(`User-agent: ${ua} ${dirType}: ${rule.pattern}`);
                }
              }
            }
          }
        }
        directive = directives.join('; ');

        return { isAllowed, status, directive };
      },
      getCrawlDelay: (userAgent = '*') => {
        if (!parser) return 0;
        const delay = parser.getCrawlDelay(userAgent);
        return delay ? delay * 1000 : 0;
      },
      getSitemaps: () => {
        if (!parser) return [];
        return parser.getSitemaps();
      }
    };
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
