import { parseSitemap } from '../../src/utils/sitemapParser.js';

describe('sitemapParser', () => {
  it('should extract URLs from a valid XML sitemap', () => {
    const xml = `
      <?xml version="1.0" encoding="UTF-8"?>
      <urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
        <url>
          <loc>https://example.com/</loc>
          <lastmod>2023-01-01</lastmod>
        </url>
        <url>
          <loc>https://example.com/about</loc>
        </url>
      </urlset>
    `;
    const urls = parseSitemap(xml);
    expect(urls).toEqual(['https://example.com/', 'https://example.com/about']);
  });

  it('should return empty array for invalid or empty input', () => {
    expect(parseSitemap(null)).toEqual([]);
    expect(parseSitemap('')).toEqual([]);
    expect(parseSitemap(123)).toEqual([]);
  });

  it('should return empty array if no <loc> tags are present', () => {
    const xml = `
      <?xml version="1.0" encoding="UTF-8"?>
      <urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
        <url>
          <lastmod>2023-01-01</lastmod>
        </url>
      </urlset>
    `;
    const urls = parseSitemap(xml);
    expect(urls).toEqual([]);
  });
});
