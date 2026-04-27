import { extractLinks } from '../../src/crawler/linkExtractor.js';

describe('linkExtractor.js のテスト', () => {
  const baseUrl = 'https://example.com/path/page.html';

  test('<a>タグから同一オリジンのリンクを抽出し絶対URLに変換する', () => {
    const html = `
      <html>
        <body>
          <a href="/about">About</a>
          <a href="contact.html">Contact</a>
          <a href="https://example.com/services">Services</a>
        </body>
      </html>
    `;
    const links = extractLinks(html, baseUrl);
    
    expect(links).toContain('https://example.com/about');
    expect(links).toContain('https://example.com/path/contact.html');
    expect(links).toContain('https://example.com/services');
    expect(links.length).toBe(3);
  });

  test('外部ドメインのリンクは除外する', () => {
    const html = `
      <html>
        <body>
          <a href="https://google.com/">Google</a>
          <a href="http://example.com/http-link">HTTP Link (different protocol but same host is fine? Let's assume strict origin or hostname. We'll use hostname for now)</a>
          <a href="//external.com/schemaless">External Schemaless</a>
          <a href="/internal">Internal</a>
        </body>
      </html>
    `;
    // 外部ドメインの除外は同一ホストネームか同一起点かを決定する。SEOツールとしては同一ホスト名が一般的。
    const links = extractLinks(html, baseUrl);
    
    expect(links).toContain('https://example.com/internal');
    expect(links).not.toContain('https://google.com/');
    expect(links).not.toContain('https://external.com/schemaless');
    // プロトコル違い（http -> https）は同一ホスト名なら許可するかどうか。今回はホスト名が一致すればOKとする。
    expect(links).toContain('http://example.com/http-link');
  });

  test('無効なプロトコルやアンカー（#）のみのリンクを除外・正規化する', () => {
    const html = `
      <html>
        <body>
          <a href="mailto:info@example.com">Mail</a>
          <a href="javascript:void(0)">JS</a>
          <a href="tel:123456789">Tel</a>
          <a href="#section1">Anchor</a>
          <a href="/page.html#section2">Page with Anchor</a>
        </body>
      </html>
    `;
    const links = extractLinks(html, baseUrl);
    
    // mailto, javascript, tel などは除外されるべき
    expect(links).not.toContain('mailto:info@example.com');
    expect(links).not.toContain('javascript:void(0)');
    expect(links).not.toContain('tel:123456789');
    
    // ベースURL + #section1 -> https://example.com/path/page.html （ハッシュは削除される）
    expect(links).toContain('https://example.com/path/page.html');
    // /page.html#section2 -> https://example.com/page.html （ハッシュは削除される）
    expect(links).toContain('https://example.com/page.html');
  });

  test('重複したリンクは除外せずそのまま返す（重複排除はCrawlManagerの責務）', () => {
    const html = `
      <html>
        <body>
          <a href="/about">About 1</a>
          <a href="/about">About 2</a>
        </body>
      </html>
    `;
    const links = extractLinks(html, baseUrl);
    
    expect(links.length).toBe(2);
    expect(links[0]).toBe('https://example.com/about');
    expect(links[1]).toBe('https://example.com/about');
  });

  test('href属性がない、または空のaタグを無視する', () => {
    const html = `
      <html>
        <body>
          <a>No Href</a>
          <a href="">Empty Href</a>
          <a href="   ">Spaces Href</a>
        </body>
      </html>
    `;
    const links = extractLinks(html, baseUrl);
    
    expect(links.length).toBe(0);
  });

  test('URLのパースに失敗するような不正なhrefは無視する', () => {
    const html = `
      <html>
        <body>
          <a href="http://">Invalid Protocol Only</a>
          <a href="http://[1:2:3:4:5:6:7:8:9]">Invalid IPv6</a>
          <a href="/valid">Valid Link</a>
        </body>
      </html>
    `;
    const links = extractLinks(html, baseUrl);

    expect(links.length).toBe(1);
    expect(links).toContain('https://example.com/valid');
  });
});
