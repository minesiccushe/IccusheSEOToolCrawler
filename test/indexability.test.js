import { evaluateIndexability } from '../src/crawler/parser.js';
import { jest } from '@jest/globals';

describe('Indexability Evaluator', () => {
  it('should return indexable for 200 OK and no restrictions', () => {
    const result = evaluateIndexability(200, { metaRobotsRaw: 'index, follow' }, 'https://example.com/test');
    expect(result).toEqual({ indexabilityFinal: 'indexable', indexabilityReason: '' });
  });

  it('should return non-indexable for 500 status', () => {
    const result = evaluateIndexability(500, {}, 'https://example.com/test');
    expect(result).toEqual({ indexabilityFinal: 'non-indexable', indexabilityReason: 'http_5xx' });
  });

  it('should return non-indexable for 404 status', () => {
    const result = evaluateIndexability(404, {}, 'https://example.com/test');
    expect(result).toEqual({ indexabilityFinal: 'non-indexable', indexabilityReason: 'http_4xx' });
  });

  it('should return non-indexable for 301 status', () => {
    const result = evaluateIndexability(301, {}, 'https://example.com/test');
    expect(result).toEqual({ indexabilityFinal: 'non-indexable', indexabilityReason: 'http_3xx' });
  });

  it('should return non-indexable for noindex meta robots', () => {
    const result = evaluateIndexability(200, { metaRobotsRaw: 'noindex, nofollow' }, 'https://example.com/test');
    expect(result).toEqual({ indexabilityFinal: 'non-indexable', indexabilityReason: 'meta_noindex' });
  });

  it('should return non-indexable for uppercase NOINDEX meta robots', () => {
    const result = evaluateIndexability(200, { metaRobotsRaw: 'NOINDEX, NOFOLLOW' }, 'https://example.com/test');
    expect(result).toEqual({ indexabilityFinal: 'non-indexable', indexabilityReason: 'meta_noindex' });
  });

  it('should return non-indexable for mixed case NoIndex meta robots', () => {
    const result = evaluateIndexability(200, { metaRobotsRaw: 'NoIndex, NoFollow' }, 'https://example.com/test');
    expect(result).toEqual({ indexabilityFinal: 'non-indexable', indexabilityReason: 'meta_noindex' });
  });

  it('should return non-indexable for random case nOiNdEx meta robots', () => {
    const result = evaluateIndexability(200, { metaRobotsRaw: 'nOiNdEx' }, 'https://example.com/test');
    expect(result).toEqual({ indexabilityFinal: 'non-indexable', indexabilityReason: 'meta_noindex' });
  });

  it('should return non-indexable for blocked by robots.txt', () => {
    const result = evaluateIndexability(200, {}, 'https://example.com/test', { status: 'disallowed' });
    expect(result).toEqual({ indexabilityFinal: 'non-indexable', indexabilityReason: 'robots_txt_block' });
  });

  it('should return non-indexable for X-Robots-Tag noindex', () => {
    const result = evaluateIndexability(200, {}, 'https://example.com/test', {}, 'noindex');
    expect(result).toEqual({ indexabilityFinal: 'non-indexable', indexabilityReason: 'x_robots_noindex' });
  });

  it('should return non-indexable for X-Robots-Tag uppercase NOINDEX', () => {
    const result = evaluateIndexability(200, {}, 'https://example.com/test', {}, 'NOINDEX');
    expect(result).toEqual({ indexabilityFinal: 'non-indexable', indexabilityReason: 'x_robots_noindex' });
  });

  it('should return non-indexable for X-Robots-Tag random case nOiNdEx', () => {
    const result = evaluateIndexability(200, {}, 'https://example.com/test', {}, 'nOiNdEx');
    expect(result).toEqual({ indexabilityFinal: 'non-indexable', indexabilityReason: 'x_robots_noindex' });
  });

  it('should return non-indexable for multiple reasons', () => {
    const result = evaluateIndexability(404, { metaRobotsRaw: 'noindex' }, 'https://example.com/test', { status: 'disallowed' }, 'noindex');
    expect(result).toEqual({ indexabilityFinal: 'non-indexable', indexabilityReason: 'http_4xx|robots_txt_block|x_robots_noindex|meta_noindex' });
  });

  describe('canonicalLink validation', () => {
    it('should return indexable when canonicalLink matches currentUrl exactly', () => {
      const result = evaluateIndexability(200, { canonicalLink: 'https://example.com/test' }, 'https://example.com/test');
      expect(result).toEqual({ indexabilityFinal: 'indexable', indexabilityReason: '' });
    });

    it('should return non-indexable for Canonicalised for different canonical link', () => {
      const result = evaluateIndexability(200, { canonicalLink: 'https://example.com/other' }, 'https://example.com/test');
      expect(result).toEqual({ indexabilityFinal: 'non-indexable', indexabilityReason: 'canonical_to_other' });
    });

    it('should handle relative canonical links correctly and return indexable if they resolve to the same absolute URL', () => {
      const result = evaluateIndexability(200, { canonicalLink: '/test' }, 'https://example.com/test');
      expect(result).toEqual({ indexabilityFinal: 'indexable', indexabilityReason: '' });
    });

    it('should handle relative canonical links correctly and return non-indexable if they resolve to a different URL', () => {
      const result = evaluateIndexability(200, { canonicalLink: '/other' }, 'https://example.com/test');
      expect(result).toEqual({ indexabilityFinal: 'non-indexable', indexabilityReason: 'canonical_to_other' });
    });

    it('should return non-indexable when canonical link has different protocol', () => {
      const result = evaluateIndexability(200, { canonicalLink: 'http://example.com/test' }, 'https://example.com/test');
      expect(result).toEqual({ indexabilityFinal: 'non-indexable', indexabilityReason: 'canonical_to_other' });
    });

    it('should handle invalid URLs gracefully without crashing and log an error', () => {
      const consoleSpy = jest.spyOn(console, 'error').mockImplementation(() => {});

      const result1 = evaluateIndexability(200, { canonicalLink: 'http://[invalid-url]' }, 'https://example.com/test');
      expect(result1).toEqual({ indexabilityFinal: 'indexable', indexabilityReason: '' });

      const result2 = evaluateIndexability(200, { canonicalLink: 'invalid-url-no-base' }, 'invalid-url-no-base');
      expect(result2).toEqual({ indexabilityFinal: 'indexable', indexabilityReason: '' });

      const result3 = evaluateIndexability(200, { canonicalLink: 'https://example.com/test' }, 'invalid-url-no-base');
      expect(result3).toEqual({ indexabilityFinal: 'indexable', indexabilityReason: '' });

      expect(consoleSpy).toHaveBeenCalledTimes(3);
      consoleSpy.mockRestore();
    });
  });
});
