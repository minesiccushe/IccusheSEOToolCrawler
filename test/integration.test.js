import { fetchUrl } from '../src/crawler/fetcher.js';
import { parseHtml, evaluateIndexability } from '../src/crawler/parser.js';

describe('Core Logic Integration', () => {
  it('should extract all 20 fields correctly from a live URL', async () => {
    const targetUrl = 'https://example.com/';
    
    // 1. Fetch
    const fetchResult = await fetchUrl(targetUrl);
    expect(fetchResult.success).toBe(true);
    expect(fetchResult.statusCode).toBe(200);
    
    // 2. Parse HTML
    const parsedData = parseHtml(fetchResult.html);
    
    // 3. Evaluate Indexability
    const indexabilityResult = evaluateIndexability(fetchResult.statusCode, parsedData, fetchResult.address);
    
    // 4. Combine into final result
    const { html, success, error, ...baseData } = fetchResult;
    const finalResult = {
      ...baseData,
      ...parsedData,
      ...indexabilityResult
    };

    // Verify fields
    const expectedKeys = [
      'address',
      'contentType',
      'statusCode',
      'status',
      'size',
      'transferred',
      'totalTransferred',
      'responseTime',
      'structuredDataExists', 'structuredDataCount', 'structuredDataTypes', 'structuredDataJsonLdCount',
      'structuredDataMicrodataCount', 'structuredDataRdfaCount', 'structuredDataInvalidCount',
      'structuredDataPrimaryType', 'hasBreadcrumbList', 'hasFAQ', 'hasArticle', 'hasProduct', 'hasOrganization',
      'title',
      'metaDescription',
      'metaKeywords',
      'h1_1',
      'h1_2',
      'h2_1',
      'h2_2',
      'h2_3',
      'metaRobots',
      'canonicalLink',
      'indexability',
      'indexabilityStatus'
    ];

    expect(Object.keys(finalResult).sort()).toEqual(expectedKeys.sort());

    // Specific checks for example.com
    expect(finalResult.address).toBe('https://example.com/');
    expect(finalResult.title).toBe('Example Domain');
    expect(finalResult.h1_1).toBe('Example Domain');
    expect(finalResult.indexability).toBe('Indexable');
    expect(typeof finalResult.size).toBe('number');
    expect(typeof finalResult.responseTime).toBe('number');
  }, 15000);
});
