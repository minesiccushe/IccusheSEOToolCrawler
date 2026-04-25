import axios from 'axios';
import axiosRetry from 'axios-retry';
import jschardet from 'jschardet';
import iconv from 'iconv-lite';

const DEFAULT_USER_AGENT = 'IccusheSEOToolCrawler/1.0(+https://github.com/minesiccushe/IccusheSEOToolCrawler)';

// axios-retry の設定
axiosRetry(axios, {
  retries: 3,
  retryDelay: axiosRetry.exponentialDelay,
  retryCondition: (error) => {
    // 429 Too Many Requests または 5xx サーバーエラーの場合にリトライ
    return axiosRetry.isNetworkOrIdempotentRequestError(error) || 
           error.response?.status === 429 || 
           (error.response?.status >= 500 && error.response?.status <= 599);
  },
  onRetry: (retryCount, error, requestConfig) => {
    console.log(`Retrying request (${retryCount}): ${requestConfig.url} - Reason: ${error.message}`);
  }
});

/**
 * 指定したURLへGETリクエストを送信し、レスポンス情報とHTMLを取得する
 * @param {string} url - 取得対象のURL
 * @param {Object} [auth=null] - { username, password } 形式のBasic認証情報
 * @returns {Promise<Object>} レスポンス情報を含むオブジェクト
 */
export async function fetchUrl(url, auth = null) {
  const startTime = Date.now();
  
  try {
    const requestOptions = {
      responseType: 'arraybuffer', // バイナリとして取得し、正確なサイズを計算
      validateStatus: () => true,  // 4xx, 5xx系でも例外を投げず処理を継続（axios-retryを使用する場合は注意が必要だが、validateStatusがtrueでもretryConditionが優先される場合がある）
      timeout: 15000,              // 15秒でタイムアウト
      headers: {
        'User-Agent': DEFAULT_USER_AGENT
      }
    };

    if (auth && auth.username && auth.password) {
      requestOptions.auth = auth;
    }

    const response = await axios.get(url, requestOptions);
    
    const responseTime = Date.now() - startTime;
    const statusCode = response.status;
    
    // Node.jsのaxiosでは statusText が空になる場合があるため、標準的なステータスがある前提とする
    const status = response.statusText || getStatusText(statusCode);
    const contentType = response.headers['content-type'] || '';
    
    // ボディのバイト数
    const dataBuffer = Buffer.from(response.data);
    const size = dataBuffer.length;
    
    // 転送量（Content-Lengthがあればそれを使用、なければボディサイズ）
    const contentLength = response.headers['content-length'];
    const transferred = contentLength ? parseInt(contentLength, 10) : size;
    
    // ヘッダのサイズを概算
    const headersString = Object.entries(response.headers)
      .map(([k, v]) => `${k}: ${v}`)
      .join('\r\n');
    const headerSize = Buffer.byteLength(headersString, 'utf8') + 4; // \r\n\r\n 分を追加
    const totalTransferred = headerSize + transferred;
    
    // HTMLテキストとして変換（文字コード自動判定）
    let html = '';
    let charset = '';
    
    // 1. Content-Typeヘッダからの文字コード取得を試みる
    const charsetMatch = contentType.match(/charset=([^;]+)/i);
    if (charsetMatch) {
      charset = charsetMatch[1].trim();
    }
    
    // 2. ヘッダで指定がない、もしくは不正な場合は HTML内の meta タグから取得を試みる
    if (!charset || !iconv.encodingExists(charset)) {
      const headString = dataBuffer.slice(0, 1024).toString('ascii');
      const metaCharsetMatch = headString.match(/<meta[^>]*charset=["']?([^"'>\s]+)["']?/i) || 
                               headString.match(/<meta[^>]*http-equiv=["']?content-type["']?[^>]*content=["']?[^"'>]*charset=([^"'>\s]+)["']?/i);
      if (metaCharsetMatch) {
        charset = metaCharsetMatch[1].trim();
      }
    }

    // 3. それでも不明な場合は jschardet で推測
    if (!charset || !iconv.encodingExists(charset)) {
      const detected = jschardet.detect(dataBuffer);
      if (detected && detected.encoding) {
        charset = detected.encoding;
      }
    }
    
    // 4. デコード（推測結果が iconv-lite でサポートされていればデコード、そうでなければ UTF-8 フォールバック）
    if (charset && iconv.encodingExists(charset)) {
      html = iconv.decode(dataBuffer, charset);
    } else {
      html = dataBuffer.toString('utf8');
    }
    
    return {
      success: true,
      address: url,
      contentType,
      statusCode,
      status,
      size,
      transferred,
      totalTransferred,
      responseTime,
      html
    };
  } catch (error) {
    const responseTime = Date.now() - startTime;
    return {
      success: false,
      address: url,
      contentType: '',
      statusCode: error.response?.status || 0,
      status: error.code || 'Error',
      size: 0,
      transferred: 0,
      totalTransferred: 0,
      responseTime,
      html: '',
      error: error.message
    };
  }
}

/**
 * 簡単なステータステキストのフォールバック
 */
function getStatusText(code) {
  const statuses = {
    200: 'OK',
    301: 'Moved Permanently',
    302: 'Found',
    403: 'Forbidden',
    404: 'Not Found',
    500: 'Internal Server Error',
    503: 'Service Unavailable'
  };
  return statuses[code] || `Status ${code}`;
}
