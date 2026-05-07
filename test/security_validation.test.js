import { jest } from '@jest/globals';

let fetchUrlHandler;
let startCrawlHandler;

// Mock electron
jest.unstable_mockModule('electron', () => {
  return {
    app: {
      whenReady: jest.fn().mockResolvedValue(),
      on: jest.fn(),
      quit: jest.fn(),
    },
    BrowserWindow: jest.fn().mockImplementation(() => ({
      loadFile: jest.fn(),
      on: jest.fn(),
      isDestroyed: jest.fn().mockReturnValue(false),
      webContents: {
        send: jest.fn(),
      }
    })),
    ipcMain: {
      handle: jest.fn((channel, handler) => {
        if (channel === 'fetch-url') {
          fetchUrlHandler = handler;
        } else if (channel === 'start-crawl') {
          startCrawlHandler = handler;
        }
      })
    },
    shell: {
      openExternal: jest.fn().mockResolvedValue()
    },
    dialog: {
      showSaveDialog: jest.fn()
    },
    clipboard: {
      writeText: jest.fn()
    }
  };
});

describe('Security: URL validation in IPC handlers', () => {
  beforeAll(async () => {
    // Import main.js to trigger the registration of IPC handlers
    await import('../main.js');
  });

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('fetch-url handler', () => {
    test('should allow http and https protocols', async () => {
      // This might still fail later in the handler due to further logic,
      // but we want to ensure it doesn't fail at protocol validation.
      // For now, we expect it NOT to return the specific protocol error we will implement.
      const result = await fetchUrlHandler(null, 'http://example.com');
      expect(result.error).not.toBe('Invalid URL protocol. Only http: and https: are allowed.');
    });

    test('should NOT allow other protocols', async () => {
      const unsafeUrls = [
        'file:///etc/passwd',
        'javascript:alert(1)',
        'data:text/html,<html>',
        'ms-settings:about'
      ];

      for (const url of unsafeUrls) {
        const result = await fetchUrlHandler(null, url);
        expect(result.error).toBe('Invalid URL protocol. Only http: and https: are allowed.');
      }
    });
  });

  describe('start-crawl handler', () => {
    test('should allow http and https protocols', async () => {
      const result = await startCrawlHandler(null, 'http://example.com', { mode: 'spider' });
      expect(result.error).not.toBe('Invalid URL protocol. Only http: and https: are allowed.');
    });

    test('should NOT allow other protocols in string input', async () => {
      const result = await startCrawlHandler(null, 'file:///etc/passwd', { mode: 'spider' });
      expect(result.error).toBe('Invalid URL protocol. Only http: and https: are allowed.');
    });

    test('should NOT allow other protocols in array input', async () => {
      const urls = ['https://example.com', 'javascript:alert(1)'];
      const result = await startCrawlHandler(null, urls, { mode: 'list' });
      expect(result.error).toBe('Invalid URL protocol. Only http: and https: are allowed.');
    });
  });
});
