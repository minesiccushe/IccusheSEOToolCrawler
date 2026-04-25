import { jest } from '@jest/globals';
import axios from 'axios';
import iconv from 'iconv-lite';
import { fetchUrl } from '../../src/crawler/fetcher.js';

describe('fetcher.js のテスト', () => {
  afterEach(() => {
    jest.restoreAllMocks();
  });

  test('正常なレスポンスの場合、パース可能なオブジェクトを返す', async () => {
    const mockHtml = '<html><body>Test</body></html>';
    const mockResponse = {
      status: 200,
      statusText: 'OK',
      headers: {
        'content-type': 'text/html; charset=utf-8',
        'content-length': Buffer.byteLength(mockHtml).toString()
      },
      data: Buffer.from(mockHtml)
    };

    jest.spyOn(axios, 'get').mockResolvedValue(mockResponse);

    const result = await fetchUrl('http://example.com');
    
    expect(axios.get).toHaveBeenCalledWith('http://example.com', expect.objectContaining({
      headers: expect.objectContaining({
        'User-Agent': expect.stringContaining('IccusheSEOToolCrawler/1.0')
      })
    }));
    expect(result.success).toBe(true);
    expect(result.statusCode).toBe(200);
    expect(result.status).toBe('OK');
    expect(result.contentType).toBe('text/html; charset=utf-8');
    expect(result.html).toBe(mockHtml);
    expect(result.size).toBe(Buffer.byteLength(mockHtml));
    expect(result.redirectUrl).toBe('');
    // ヘッダサイズ計算のロジックが組み込まれているため totalTransferred は size より大きくなる
    expect(result.totalTransferred).toBeGreaterThan(result.size);
    expect(typeof result.responseTime).toBe('number');
  });

  test('Shift-JISのレスポンスを自動判定し、UTF-8にデコードして返す', async () => {
    const mockHtmlStr = '<html><body>テスト Shift-JIS</body></html>';
    const shiftJisBuffer = iconv.encode(mockHtmlStr, 'Shift_JIS');
    
    const mockResponse = {
      status: 200,
      statusText: 'OK',
      headers: {
        'content-type': 'text/html; charset=Shift_JIS',
        'content-length': shiftJisBuffer.length.toString()
      },
      data: shiftJisBuffer
    };

    jest.spyOn(axios, 'get').mockResolvedValue(mockResponse);

    const result = await fetchUrl('http://example.com/sjis');
    
    expect(result.success).toBe(true);
    expect(result.html).toBe(mockHtmlStr);
  });

  test('ヘッダにcharsetがない場合もjschardetで判定してデコードする', async () => {
    const mockHtmlStr = '<html><head><meta charset="EUC-JP"></head><body>テスト EUC-JP</body></html>';
    const eucjpBuffer = iconv.encode(mockHtmlStr, 'EUC-JP');
    
    const mockResponse = {
      status: 200,
      statusText: 'OK',
      headers: {
        'content-type': 'text/html', // charset指定なし
        'content-length': eucjpBuffer.length.toString()
      },
      data: eucjpBuffer
    };

    jest.spyOn(axios, 'get').mockResolvedValue(mockResponse);

    const result = await fetchUrl('http://example.com/eucjp');
    
    expect(result.success).toBe(true);
    expect(result.html).toBe(mockHtmlStr);
  });

  test('ネットワークエラーや例外が発生した場合、success: false のオブジェクトを返す', async () => {
    const mockError = new Error('Network Error');
    mockError.code = 'ENOTFOUND';
    
    jest.spyOn(axios, 'get').mockRejectedValue(mockError);

    const result = await fetchUrl('http://invalid.url');
    
    expect(result.success).toBe(false);
    expect(result.statusCode).toBe(0); // responseがないため
    expect(result.status).toBe('ENOTFOUND');
    expect(result.error).toBe('Network Error');
    expect(result.html).toBe('');
  });

  test('ステータスコードが4xx/5xxで、レスポンスが存在するエラーの場合', async () => {
    const mockError = new Error('Request failed with status code 404');
    mockError.response = { status: 404 };
    mockError.code = 'ERR_BAD_REQUEST';
    
    jest.spyOn(axios, 'get').mockRejectedValue(mockError);

    const result = await fetchUrl('http://example.com/404');
    
    expect(result.success).toBe(false);
    expect(result.statusCode).toBe(404);
    expect(result.status).toBe('ERR_BAD_REQUEST');
  });

  test('3xxリダイレクトで、locationヘッダが存在する場合にredirectUrlがセットされること', async () => {
    const mockResponse = {
      status: 301,
      statusText: 'Moved Permanently',
      headers: {
        location: 'https://example.com/redirected'
      },
      data: Buffer.from('')
    };

    jest.spyOn(axios, 'get').mockResolvedValue(mockResponse);

    const result = await fetchUrl('http://example.com');

    expect(result.success).toBe(true);
    expect(result.statusCode).toBe(301);
    expect(result.redirectUrl).toBe('https://example.com/redirected');
  });

  test('Basic認証情報が提供された場合、axiosのオプションにauthが含まれること', async () => {
    const mockResponse = {
      status: 200, statusText: 'OK', headers: {}, data: Buffer.from('Test')
    };
    jest.spyOn(axios, 'get').mockResolvedValue(mockResponse);

    const auth = { username: 'testuser', password: 'testpassword' };
    await fetchUrl('http://example.com/auth', auth);

    expect(axios.get).toHaveBeenCalledWith('http://example.com/auth', expect.objectContaining({
      auth: { username: 'testuser', password: 'testpassword' }
    }));
  });
});
