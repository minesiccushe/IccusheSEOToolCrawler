import { parseHtml } from '../src/crawler/parser.js';

describe('HTML Parser', () => {
  it('should extract all specified fields correctly', () => {
    const html = `
      <!DOCTYPE html>
      <html>
      <head>
        <title>Test Title</title>
        <meta name="description" content="Test Description">
        <meta name="keywords" content="test, keyword">
        <meta name="robots" content="index, follow">
        <link rel="canonical" href="https://example.com/test">
      </head>
      <body>
        <h1>Main Heading</h1>
        <h1>Second Heading</h1>
        <h2>Sub Heading 1</h2>
        <h2>Sub Heading 2</h2>
        <h2>Sub Heading 3</h2>
        <h2>Sub Heading 4</h2>
      </body>
      </html>
    `;
    
    const result = parseHtml(html);
    
    expect(result).toEqual({
      title: 'Test Title',
      metaDescription: 'Test Description',
      metaKeywords: 'test, keyword',
      h1_1: 'Main Heading',
      h1_2: 'Second Heading',
      h2_1: 'Sub Heading 1',
      h2_2: 'Sub Heading 2',
      h2_3: 'Sub Heading 3',
      metaRobots: 'index, follow',
      canonicalLink: 'https://example.com/test'
    });
  });

  it('should handle missing elements gracefully', () => {
    const html = `
      <!DOCTYPE html>
      <html>
      <head>
      </head>
      <body>
      </body>
      </html>
    `;
    
    const result = parseHtml(html);
    
    expect(result).toEqual({
      title: '',
      metaDescription: '',
      metaKeywords: '',
      h1_1: '',
      h1_2: '',
      h2_1: '',
      h2_2: '',
      h2_3: '',
      metaRobots: '',
      canonicalLink: ''
    });
  });

  it('should handle missing attributes gracefully', () => {
    const html = `
      <!DOCTYPE html>
      <html>
      <head>
        <meta name="description">
        <meta name="keywords">
        <meta name="robots">
        <link rel="canonical">
      </head>
      <body>
      </body>
      </html>
    `;
    
    const result = parseHtml(html);
    
    expect(result).toEqual({
      title: '',
      metaDescription: '',
      metaKeywords: '',
      h1_1: '',
      h1_2: '',
      h2_1: '',
      h2_2: '',
      h2_3: '',
      metaRobots: '',
      canonicalLink: ''
    });
  });
});
