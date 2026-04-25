import { jest } from '@jest/globals';

// Mock electron
jest.unstable_mockModule('electron', () => {
  return {
    contextBridge: {
      exposeInMainWorld: jest.fn()
    },
    ipcRenderer: {
      invoke: jest.fn()
    },
    ipcMain: {
      handle: jest.fn()
    },
    app: {
      whenReady: jest.fn().mockResolvedValue(),
      on: jest.fn(),
      quit: jest.fn(),
      getAppPath: jest.fn().mockReturnValue('')
    },
    BrowserWindow: jest.fn().mockImplementation(() => ({
      loadFile: jest.fn(),
      webContents: {
        openDevTools: jest.fn()
      }
    })),
    dialog: {
      showSaveDialog: jest.fn().mockResolvedValue({ canceled: false, filePath: 'test.csv' })
    },
    clipboard: {
      writeText: jest.fn()
    },
    shell: {
      openExternal: jest.fn()
    }
  };
});

describe('IPC Communication', () => {
  let electron;
  
  beforeEach(async () => {
    electron = await import('electron');
    jest.clearAllMocks();
  });

  // main.js を1度だけインポートして全ハンドラ登録を一括確認する
  test('main process が全IPCハンドラを正しく登録すること', async () => {
    await import('../main.js');

    // 登録が期待されるハンドラ一覧
    const expectedHandlers = [
      'fetch-url',
      'start-crawl',
      'pause-crawl',
      'resume-crawl',
      'stop-crawl',
      'export-csv'
    ];

    // ipcMain.handle に渡された第1引数のチャンネル名を収集する
    const registeredChannels = electron.ipcMain.handle.mock.calls.map(([channel]) => channel);

    expectedHandlers.forEach(channel => {
      expect(registeredChannels).toContain(channel);
    });
  });
});
