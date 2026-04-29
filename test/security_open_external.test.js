import { jest } from '@jest/globals';

let openExternalHandler;

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
        if (channel === 'open-external') {
          openExternalHandler = handler;
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

describe('Security: open-external IPC handler', () => {
  let electron;

  beforeAll(async () => {
    // Import main.js to trigger the registration of IPC handlers
    await import('../main.js');
    electron = await import('electron');
  });

  beforeEach(() => {
    jest.clearAllMocks();
  });

  test('should allow http and https protocols', async () => {
    if (!openExternalHandler) {
        throw new Error('open-external handler not registered');
    }
    await openExternalHandler(null, 'http://example.com');
    expect(electron.shell.openExternal).toHaveBeenCalledWith('http://example.com/');

    await openExternalHandler(null, 'https://example.com');
    expect(electron.shell.openExternal).toHaveBeenCalledWith('https://example.com/');
  });

  test('should NOT allow other protocols', async () => {
    if (!openExternalHandler) {
        throw new Error('open-external handler not registered');
    }

    const unsafeUrls = [
        'file:///etc/passwd',
        'javascript:alert(1)',
        'data:text/html,<html>',
        'ms-settings:about',
        'powershell:process'
    ];

    for (const url of unsafeUrls) {
        await openExternalHandler(null, url);
        expect(electron.shell.openExternal).not.toHaveBeenCalledWith(url);
    }
  });
});
