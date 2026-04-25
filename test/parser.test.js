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
    
    expect(result).toEqual({
      title: 'Test Title',
      metaDescription: 'Test Description',
      metaKeywords: 'test, keyword',
      h1_1: 'Main Heading',
      h1_2: 'Second Heading',
      h2_1: 'Sub Heading 1',
      h2_2: 'Sub Heading 2',
      h2_3: 'Sub Heading 3',
      metaRobotsRaw: 'index, follow',
      metaRobotsIndex: true,
      metaRobotsFollow: true,
      canonicalLink: 'https://example.com/test',
      metaRobots: 'index, follow',
      canonicalLink: 'https://example.com/test',
      h1Count: 2,
      h2Count: 4,
      h3Count: 0,
      h4Count: 1,
      h5Count: 0,
      h6Count: 0,
      h1Texts: 'Main Heading|Second Heading',
      h2Texts: 'Sub Heading 1|Sub Heading 2|Sub Heading 3|Sub Heading 4',
      h3Texts: '',
      hasMultipleH1: true,
      missingH1: false,
      headingOrderValid: false,
      headingHierarchyIssues: 'h2→h4',
      firstH1Text: 'Main Heading',
      longestHeadingTextLength: 14,
      emptyHeadingCount: 0,
      internalLinkCount: 0,
      externalLinkCount: 0,
      internalNofollowCount: 0,
      externalNofollowCount: 0,
      internalLinkUrls: '',
      externalLinkUrls: '',
      internalAnchorTexts: '',
      externalAnchorTexts: '',
      internalLinkUniqueCount: 0,
      externalLinkUniqueCount: 0,
      selfLinkCount: 0,
      hasBreadcrumbLink: false,
      linkToTopPage: false,
      linkDepthEstimate: 1,
      structuredDataExists: false,
      structuredDataCount: 0,
      structuredDataTypes: '',
      structuredDataJsonLdCount: 0,
      structuredDataMicrodataCount: 0,
      structuredDataRdfaCount: 0,
      structuredDataInvalidCount: 0,
      structuredDataPrimaryType: '',
      hasBreadcrumbList: false,
      hasFAQ: false,
      hasArticle: false,
      hasProduct: false,
      hasOrganization: false
    });
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
    expect(result.externalNofollowCount).toBe(0);
    expect(result.selfLinkCount).toBe(1); // Self
    expect(result.hasBreadcrumbLink).toBe(true);
    expect(result.linkToTopPage).toBe(true); // /
    expect(result.linkDepthEstimate).toBe(1); // /test is 1 part
    expect(result.internalLinkUniqueCount).toBe(4); // 4 unique
    expect(result.externalLinkUniqueCount).toBe(1); // 1 unique
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
      metaRobotsRaw: '',
      metaRobotsIndex: true,
      metaRobotsFollow: true,
      canonicalLink: '',
      metaRobots: '',
      canonicalLink: '',
      h1Count: 0,
      h2Count: 0,
      h3Count: 0,
      h4Count: 0,
      h5Count: 0,
      h6Count: 0,
      h1Texts: '',
      h2Texts: '',
      h3Texts: '',
      hasMultipleH1: false,
      missingH1: true,
      headingOrderValid: true,
      headingHierarchyIssues: '',
      firstH1Text: '',
      longestHeadingTextLength: 0,
      emptyHeadingCount: 0,
      internalLinkCount: 0,
      externalLinkCount: 0,
      internalNofollowCount: 0,
      externalNofollowCount: 0,
      internalLinkUrls: '',
      externalLinkUrls: '',
      internalAnchorTexts: '',
      externalAnchorTexts: '',
      internalLinkUniqueCount: 0,
      externalLinkUniqueCount: 0,
      selfLinkCount: 0,
      hasBreadcrumbLink: false,
      linkToTopPage: false,
      linkDepthEstimate: 0,
      structuredDataExists: false,
      structuredDataCount: 0,
      structuredDataTypes: '',
      structuredDataJsonLdCount: 0,
      structuredDataMicrodataCount: 0,
      structuredDataRdfaCount: 0,
      structuredDataInvalidCount: 0,
      structuredDataPrimaryType: '',
      hasBreadcrumbList: false,
      hasFAQ: false,
      hasArticle: false,
      hasProduct: false,
      hasOrganization: false
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
      metaRobotsRaw: '',
      metaRobotsIndex: true,
      metaRobotsFollow: true,
      canonicalLink: '',
      metaRobots: '',
      canonicalLink: '',
      h1Count: 0,
      h2Count: 0,
      h3Count: 0,
      h4Count: 0,
      h5Count: 0,
      h6Count: 0,
      h1Texts: '',
      h2Texts: '',
      h3Texts: '',
      hasMultipleH1: false,
      missingH1: true,
      headingOrderValid: true,
      headingHierarchyIssues: '',
      firstH1Text: '',
      longestHeadingTextLength: 0,
      emptyHeadingCount: 0,
      internalLinkCount: 0,
      externalLinkCount: 0,
      internalNofollowCount: 0,
      externalNofollowCount: 0,
      internalLinkUrls: '',
      externalLinkUrls: '',
      internalAnchorTexts: '',
      externalAnchorTexts: '',
      internalLinkUniqueCount: 0,
      externalLinkUniqueCount: 0,
      selfLinkCount: 0,
      hasBreadcrumbLink: false,
      linkToTopPage: false,
      linkDepthEstimate: 0,
      structuredDataExists: false,
      structuredDataCount: 0,
      structuredDataTypes: '',
      structuredDataJsonLdCount: 0,
      structuredDataMicrodataCount: 0,
      structuredDataRdfaCount: 0,
      structuredDataInvalidCount: 0,
      structuredDataPrimaryType: '',
      hasBreadcrumbList: false,
      hasFAQ: false,
      hasArticle: false,
      hasProduct: false,
      hasOrganization: false
    });
  });
});

  it('should extract heading elements correctly excluding script/style and hidden ones', () => {
    const html = `
      <!DOCTYPE html>
      <html>
      <head></head>
      <body>
        <h1>Visible H1</h1>
        <h2 style="display:none;">Hidden inline style</h2>
        <h2 style="display: none;">Hidden inline style 2</h2>
        <h2><script>console.log('test');</script>Visible H2</h2>
        <h3 aria-hidden="true">Aria hidden</h3>
        <h3>Visible H3 <span>with span</span></h3>
        <h1></h1>
        <h2>  </h2>
        <h5></h5>
      </body>
      </html>
    `;
    const result = parseHtml(html);

    expect(result.h1Count).toBe(2);
    expect(result.h2Count).toBe(2); // Script one and empty one
    expect(result.h3Count).toBe(1);
    expect(result.h4Count).toBe(0);
    expect(result.h5Count).toBe(1);
    expect(result.h6Count).toBe(0);
    expect(result.h1Texts).toBe('Visible H1');
    expect(result.h2Texts).toBe('Visible H2');
    expect(result.h3Texts).toBe('Visible H3 with span');
    expect(result.hasMultipleH1).toBe(true);
    expect(result.missingH1).toBe(false);
    expect(result.headingOrderValid).toBe(false);
    expect(result.headingHierarchyIssues).toBe('h2→h5');
    expect(result.firstH1Text).toBe('Visible H1');
    expect(result.emptyHeadingCount).toBe(3);
    expect(result.longestHeadingTextLength).toBe(20); // 'Visible H3 with span' length
  });
