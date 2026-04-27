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
        <h4>Invalid Order</h4>
      </body>
      </html>
    `;
    
    const result = parseHtml(html, 'https://example.com/test');
    
    expect(result.title).toBe('Test Title');
    expect(result.metaDescription).toBe('Test Description');
    expect(result.metaKeywords).toBe('test, keyword');
    expect(result.h1_1).toBe('Main Heading');
    expect(result.h1_2).toBe('Second Heading');
    expect(result.h2_1).toBe('Sub Heading 1');
    expect(result.h2_2).toBe('Sub Heading 2');
    expect(result.h2_3).toBe('Sub Heading 3');
    expect(result.metaRobotsRaw).toBe('index, follow');
    expect(result.metaRobotsIndex).toBe(true);
    expect(result.metaRobotsFollow).toBe(true);
    expect(result.canonicalLink).toBe('https://example.com/test');
    expect(result.h1Count).toBe(2);
    expect(result.h2Count).toBe(4);
    expect(result.h1Texts).toBe('Main Heading|Second Heading');
    expect(result.h2Texts).toBe('Sub Heading 1|Sub Heading 2|Sub Heading 3|Sub Heading 4');
    expect(result.hasMultipleH1).toBe(true);
    expect(result.missingH1).toBe(false);
    expect(result.headingOrderValid).toBe(false);
    expect(result.headingHierarchyIssues).toBe('h2→h4');
    expect(result.firstH1Text).toBe('Main Heading');
  });

  it('should extract link data correctly', () => {
    const html = `
      <!DOCTYPE html>
      <html>
      <body>
        <nav>
          <a href="/">Top</a>
          <a href="/about">About</a>
        </nav>
        <a href="https://example.com/contact" rel="nofollow">Contact</a>
        <a href="https://external.com/link">External</a>
        <a href="javascript:void(0)">JS</a>
        <a href="#">Hash</a>
        <a href="https://example.com/test">Self</a>
        <div class="breadcrumb">
          <a href="/">Top</a> > <span>Current</span>
        </div>
      </body>
      </html>
    `;

    const result = parseHtml(html, 'https://example.com/test');

    expect(result.internalLinkCount).toBe(5); // /, /about, Contact, Self, / (breadcrumb)
    expect(result.externalLinkCount).toBe(1); // External
    expect(result.internalNofollowCount).toBe(1); // Contact
    expect(result.selfLinkCount).toBe(1); // Self
    expect(result.hasBreadcrumbLink).toBe(true);
    expect(result.linkToTopPage).toBe(true);
    expect(result.internalLinkUniqueCount).toBe(4);
    expect(result.externalLinkUniqueCount).toBe(1);
  });

  it('should handle missing elements gracefully', () => {
    const html = `
      <!DOCTYPE html>
      <html>
      <head></head>
      <body></body>
      </html>
    `;
    
    const result = parseHtml(html);
    
    expect(result.title).toBe('');
    expect(result.h1Count).toBe(0);
    expect(result.missingH1).toBe(true);
    expect(result.internalLinkCount).toBe(0);
    expect(result.structuredDataExists).toBe(false);
  });

  it('should extract heading elements correctly excluding script/style and hidden ones', () => {
    const html = `
      <!DOCTYPE html>
      <html>
      <body>
        <h1>Visible H1</h1>
        <h2 style="display:none;">Hidden</h2>
        <h2><script>console.log('test');</script>Visible H2</h2>
        <h3 aria-hidden="true">Aria hidden</h3>
        <h3>Visible H3 <span>span</span></h3>
        <h1></h1>
        <h2>  </h2>
      </body>
      </html>
    `;
    const result = parseHtml(html);

    expect(result.h1Count).toBe(2);
    expect(result.h2Count).toBe(2);
    expect(result.h3Count).toBe(1);
    expect(result.h1Texts).toBe('Visible H1');
    expect(result.h2Texts).toBe('Visible H2');
    expect(result.h3Texts).toBe('Visible H3 span');
    expect(result.emptyHeadingCount).toBe(2); // h1(empty) and h2(spaces)
  });

  it('should extract Image SEO data correctly', () => {
    const html = `
      <!DOCTYPE html>
      <html>
      <body>
        <img src="/img/internal1.jpg" alt="Logo">
        <img src="/img/internal1.jpg" alt="Logo"> <!-- Duplicate src, Duplicate Alt -->
        <img src="https://external.com/photo.png" alt="External Photo" loading="lazy">
        <img src="data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8/5+hHgAHggJ/PchI7wAAAABJRU5ErkJggg==" alt="Base64"> <!-- Ignored src -->
        <img src="/img/no-alt.webp"> <!-- No Alt -->
        <img src="/img/empty-alt.svg" alt=""> <!-- Empty Alt -->
        <img src="/img/no-dimensions.gif" alt="Gif"> <!-- No Width/Height -->
        <img src="/img/with-dimensions.jpg" alt="Sized" width="100" height="100">
        <img data-src="/img/lazy.jpg" alt="Lazy"> <!-- data-src Lazy -->
      </body>
      </html>
    `;

    const result = parseHtml(html, 'https://example.com/test');

    expect(result.imageCount).toBe(9);
    expect(result.imageUniqueCount).toBe(7); 
    expect(result.imageWithAltCount).toBe(8); 
    expect(result.imageWithoutAltCount).toBe(1);
    expect(result.imageEmptyAltCount).toBe(1);
    expect(result.imageAltDuplicateCount).toBe(1); 
    expect(result.imageLazyLoadCount).toBe(2);
    expect(result.imageWithoutWidthHeightCount).toBe(8);
    expect(result.imageExternalCount).toBe(1);
    expect(result.imageInternalCount).toBe(7);
    const formats = result.imageFormats.split('|');
    expect(formats).toContain('jpg');
    expect(formats).toContain('png');
    expect(formats).toContain('webp');
    expect(formats).toContain('svg');
    expect(formats).toContain('gif');
    expect(result.imageAltCoverageRate).toBeCloseTo(0.89, 2); 
  });
});
