import { evaluateIndexability } from '../src/crawler/parser.js';

describe('Indexability Evaluator', () => {
  it('should return Indexable for 200 OK and no restrictions', () => {
    const result = evaluateIndexability(200, { metaRobots: 'index, follow', canonicalLink: 'https://example.com/test' }, 'https://example.com/test');
    expect(result).toEqual({ indexability: 'Indexable', indexabilityStatus: '' });
  });

  it('should return Non-Indexable / Server Error for 500 status', () => {
    const result = evaluateIndexability(500, {}, 'https://example.com/test');
    expect(result).toEqual({ indexability: 'Non-Indexable', indexabilityStatus: 'Server Error' });
  });

  it('should return Non-Indexable / Client Error for 404 status', () => {
    const result = evaluateIndexability(404, {}, 'https://example.com/test');
    expect(result).toEqual({ indexability: 'Non-Indexable', indexabilityStatus: 'Client Error' });
  });

  it('should return Non-Indexable / Redirection for 301 status', () => {
    const result = evaluateIndexability(301, {}, 'https://example.com/test');
    expect(result).toEqual({ indexability: 'Non-Indexable', indexabilityStatus: 'Redirection' });
  });

  it('should return Non-Indexable / noindex for noindex meta robots', () => {
    const result = evaluateIndexability(200, { metaRobots: 'noindex, nofollow' }, 'https://example.com/test');
    expect(result).toEqual({ indexability: 'Non-Indexable', indexabilityStatus: 'noindex' });
  });

  it('should return Non-Indexable / Canonicalised for different canonical link', () => {
    const result = evaluateIndexability(200, { canonicalLink: 'https://example.com/other' }, 'https://example.com/test');
    expect(result).toEqual({ indexability: 'Non-Indexable', indexabilityStatus: 'Canonicalised' });
  });

  it('should handle relative canonical links correctly', () => {
    // Both resolve to the same absolute URL
    const result1 = evaluateIndexability(200, { canonicalLink: '/test' }, 'https://example.com/test');
    expect(result1).toEqual({ indexability: 'Indexable', indexabilityStatus: '' });

    // Resolves to different URL
    const result2 = evaluateIndexability(200, { canonicalLink: '/other' }, 'https://example.com/test');
    expect(result2).toEqual({ indexability: 'Non-Indexable', indexabilityStatus: 'Canonicalised' });
  });
});
