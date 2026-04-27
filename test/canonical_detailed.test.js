import { parseHtml } from '../src/crawler/parser.js';

describe('Canonical Detailed Analysis', () => {
  it('should detect self-referential canonical', () => {
    const url = 'https://example.com/page';
    const html = `
      <html>
      <head><link rel="canonical" href="${url}"></head>
      <body></body>
      </html>
    `;
    const result = parseHtml(html, url);
    expect(result.canonicalUrl).toBe(url);
    expect(result.canonicalStatus).toBe('present');
    expect(result.canonicalType).toBe('self');
    expect(result.canonicalSelfReference).toBe(true);
    expect(result.canonicalMismatch).toBe(false);
  });

  it('should detect canonical to other URL', () => {
    const url = 'https://example.com/page-a';
    const canonical = 'https://example.com/page-b';
    const html = `
      <html>
      <head><link rel="canonical" href="${canonical}"></head>
      <body></body>
      </html>
    `;
    const result = parseHtml(html, url);
    expect(result.canonicalUrl).toBe(canonical);
    expect(result.canonicalStatus).toBe('present');
    expect(result.canonicalType).toBe('other');
    expect(result.canonicalSelfReference).toBe(false);
    expect(result.canonicalMismatch).toBe(true);
  });

  it('should detect multiple canonicals', () => {
    const url = 'https://example.com/page';
    const html = `
      <html>
      <head>
        <link rel="canonical" href="https://example.com/a">
        <link rel="canonical" href="https://example.com/b">
      </head>
      <body></body>
      </html>
    `;
    const result = parseHtml(html, url);
    expect(result.canonicalStatus).toBe('multiple');
  });

  it('should detect protocol mismatch', () => {
    const url = 'https://example.com/page';
    const canonical = 'http://example.com/page';
    const html = `<html><head><link rel="canonical" href="${canonical}"></head></html>`;
    const result = parseHtml(html, url);
    expect(result.canonicalProtocolMismatch).toBe(true);
    expect(result.canonicalMismatch).toBe(true);
  });

  it('should detect trailing slash mismatch', () => {
    const url = 'https://example.com/page';
    const canonical = 'https://example.com/page/';
    const html = `<html><head><link rel="canonical" href="${canonical}"></head></html>`;
    const result = parseHtml(html, url);
    expect(result.canonicalTrailingSlashMismatch).toBe(true);
    expect(result.canonicalMismatch).toBe(true);
  });

  it('should detect parameter mismatch', () => {
    const url = 'https://example.com/page?id=1';
    const canonical = 'https://example.com/page';
    const html = `<html><head><link rel="canonical" href="${canonical}"></head></html>`;
    const result = parseHtml(html, url);
    expect(result.canonicalParameterMismatch).toBe(true);
    expect(result.canonicalMismatch).toBe(true);
  });

  it('should handle relative canonical', () => {
    const url = 'https://example.com/dir/page';
    const canonical = '../other-page';
    const html = `<html><head><link rel="canonical" href="${canonical}"></head></html>`;
    const result = parseHtml(html, url);
    expect(result.canonicalUrl).toBe('https://example.com/other-page');
    expect(result.canonicalRelative).toBe(true);
  });

  it('should detect invalid canonical URL', () => {
    const url = 'https://example.com/page';
    const html = `<html><head><link rel="canonical" href="invalid-url-with-spaces "></head></html>`;
    // Note: URL constructor might actually parse some things, but let's test if it handles it.
    const result = parseHtml(html, url);
    // If it's valid according to URL constructor with base, it will be absolute.
    // Let's check for something truly invalid.
    const html2 = `<html><head><link rel="canonical" href="http://"></head></html>`;
    const result2 = parseHtml(html2, url);
    expect(result2.canonicalStatus).toBe('invalid');
  });
});
