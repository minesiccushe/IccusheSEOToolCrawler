import { jest } from '@jest/globals';
import { traceCanonicalChain } from '../src/crawler/canonicalTracker.js';
import axios from 'axios';

describe('Canonical Tracker', () => {
  afterEach(() => {
    jest.clearAllMocks();
  });

  it('should track a simple chain', async () => {
    const startUrl = 'https://a.com/';
    const bUrl = 'https://b.com/';
    const cUrl = 'https://c.com/';

    jest.spyOn(axios, 'get').mockImplementation(async (url) => {
      if (url === bUrl) {
        return {
          status: 200,
          headers: { 'content-type': 'text/html' },
          data: Buffer.from(`<html><head><link rel="canonical" href="${cUrl}"></head></html>`),
          statusText: 'OK'
        };
      }
      if (url === cUrl) {
        return {
          status: 200,
          headers: { 'content-type': 'text/html' },
          data: Buffer.from(`<html><head></head></html>`),
          statusText: 'OK'
        };
      }
      return { status: 404, headers: {}, data: Buffer.from('') };
    });

    const result = await traceCanonicalChain(startUrl, bUrl);
    expect(result.canonicalChain).toBe('https://a.com/|https://b.com/|https://c.com/');
    expect(result.canonicalChainLength).toBe(3);
    expect(result.canonicalLoopFlag).toBe(false);
  });

  it('should detect a loop', async () => {
    const startUrl = 'https://a.com/';
    const bUrl = 'https://b.com/';

    jest.spyOn(axios, 'get').mockImplementation(async (url) => {
      if (url === bUrl) {
        return {
          status: 200,
          headers: { 'content-type': 'text/html' },
          data: Buffer.from(`<html><head><link rel="canonical" href="${startUrl}"></head></html>`),
          statusText: 'OK'
        };
      }
      return { status: 404, headers: {}, data: Buffer.from('') };
    });

    const result = await traceCanonicalChain(startUrl, bUrl);
    expect(result.canonicalChain).toBe('https://a.com/|https://b.com/|https://a.com/');
    expect(result.canonicalLoopFlag).toBe(true);
  });

  it('should stop at 5 hops', async () => {
    const startUrl = 'https://0.com/';
    
    jest.spyOn(axios, 'get').mockImplementation(async (url) => {
      const match = url.match(/https:\/\/(\d+)\.com\//);
      if (match) {
        const num = parseInt(match[1]);
        return {
          status: 200,
          headers: { 'content-type': 'text/html' },
          data: Buffer.from(`<html><head><link rel="canonical" href="https://${num + 1}.com/"></head></html>`),
          statusText: 'OK'
        };
      }
      return { status: 404, headers: {}, data: Buffer.from('') };
    });

    const result = await traceCanonicalChain(startUrl, 'https://1.com/');
    // 0 -> 1 -> 2 -> 3 -> 4 -> 5 -> 6 (stopped at 5 hops after 0)
    // Wait, the loop in code is for (let i = 0; i < maxHops; i++) where maxHops = 5.
    // i=0: fetches 1, finds 2. chain [0, 1]
    // i=1: fetches 2, finds 3. chain [0, 1, 2]
    // i=2: fetches 3, finds 4. chain [0, 1, 2, 3]
    // i=3: fetches 4, finds 5. chain [0, 1, 2, 3, 4]
    // i=4: fetches 5, finds 6. chain [0, 1, 2, 3, 4, 5]
    // loop ends.
    expect(result.canonicalChainLength).toBe(6);
    expect(result.canonicalChain).toContain('https://5.com/');
  });
});
