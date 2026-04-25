import { jest } from '@jest/globals';
import axios from 'axios';
import robotsHandler from '../src/crawler/robotsHandler.js';

describe('robotsHandler', () => {
  beforeEach(() => {
    robotsHandler.clearCache();
    jest.restoreAllMocks();
  });

  it('should fetch and parse robots.txt correctly', async () => {
    const robotsTxtContent = `
      User-agent: *
      Disallow: /private/
      Allow: /private/public.html
    `;
    
    jest.spyOn(axios, 'get').mockResolvedValueOnce({
      status: 200,
      data: robotsTxtContent
    });

    const isAllowedPublic = await robotsHandler.isAllowed('http://example.com/public.html', '*');
    const isAllowedPrivate = await robotsHandler.isAllowed('http://example.com/private/secret.html', '*');
    const isAllowedException = await robotsHandler.isAllowed('http://example.com/private/public.html', '*');

    expect(isAllowedPublic).toBe(true);
    expect(isAllowedPrivate).toBe(false);
    expect(isAllowedException).toBe(true);
    
    // axios.get should be called only once due to caching
    expect(axios.get).toHaveBeenCalledTimes(1);
    expect(axios.get).toHaveBeenCalledWith('http://example.com/robots.txt', expect.any(Object));
  });

  it('should allow all if robots.txt returns 404', async () => {
    jest.spyOn(axios, 'get').mockResolvedValueOnce({
      status: 404,
      data: 'Not Found'
    });

    const isAllowed = await robotsHandler.isAllowed('http://example.com/page.html');
    expect(isAllowed).toBe(true);
  });

  it('should allow all if fetching robots.txt throws an error', async () => {
    jest.spyOn(axios, 'get').mockRejectedValueOnce(new Error('Network Error'));

    const isAllowed = await robotsHandler.isAllowed('http://example.com/page.html');
    expect(isAllowed).toBe(true);
  });

  it('should use Basic auth if provided', async () => {
    jest.spyOn(axios, 'get').mockResolvedValueOnce({
      status: 200,
      data: 'User-agent: *\nDisallow: /'
    });

    const auth = { username: 'user', password: 'password' };
    await robotsHandler.isAllowed('http://example.com/page.html', '*', auth);

    expect(axios.get).toHaveBeenCalledWith('http://example.com/robots.txt', expect.objectContaining({
      auth: auth
    }));
  });

  it('should return false for invalid URLs', async () => {
    jest.spyOn(axios, 'get');
    const isAllowed = await robotsHandler.isAllowed('invalid-url');
    expect(isAllowed).toBe(false);
    expect(axios.get).not.toHaveBeenCalled();
  });

  it('should return crawl delay correctly', async () => {
    const robotsTxtContent = `
      User-agent: *
      Crawl-delay: 5
    `;
    
    jest.spyOn(axios, 'get').mockResolvedValueOnce({
      status: 200,
      data: robotsTxtContent
    });

    const delay = await robotsHandler.getCrawlDelay('http://example.com/page.html', '*');
    expect(delay).toBe(5000); // 5 seconds * 1000
  });
});
