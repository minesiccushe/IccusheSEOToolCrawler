import { app, BrowserWindow, ipcMain, dialog, shell, clipboard } from 'electron';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

let mainWindow;
let crawlManagerInstance = null;

/**
 * URLが有効かつ http: または https: プロトコルを使用しているかチェックする
 * @param {string} urlStr
 * @returns {boolean}
 */
function isValidHttpUrl(urlStr) {
  try {
    const url = new URL(urlStr);
    return ['http:', 'https:'].includes(url.protocol);
  } catch (e) {
    return false;
  }
}

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1200,
    height: 800,
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      preload: path.join(__dirname, 'preload.cjs')
    }
  });

  mainWindow.loadFile(path.join(__dirname, 'src', 'renderer', 'index.html'));
  

}

app.whenReady().then(() => {
  createWindow();

  app.on('activate', function () {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on('window-all-closed', function () {
  if (process.platform !== 'darwin') app.quit();
});

// Phase 2 互換用（単一URL取得）
ipcMain.handle('fetch-url', async (event, url) => {
  if (!isValidHttpUrl(url)) {
    return { success: false, error: 'Invalid URL protocol. Only http: and https: are allowed.' };
  }
  try {
    const { fetchUrl } = await import('./src/crawler/fetcher.js');
    const { parseHtml, evaluateIndexability } = await import('./src/crawler/parser.js');
    const robotsHandler = (await import('./src/crawler/robotsHandler.js')).default;
    
    // Check robots.txt first
    const robotsResult = await robotsHandler.evaluate(url, 'IccusheSEOToolCrawler/1.0', null);

    const response = await fetchUrl(url);

    const parsedData = response.html ? parseHtml(response.html) : {};
    const { indexabilityFinal, indexabilityReason } = evaluateIndexability(
        response.statusCode, parsedData, url, robotsResult, response.xRobotsTag || ''
    );
    
    return {
      success: true,
      data: {
        address: url, contentType: response.contentType, statusCode: response.statusCode, status: response.status,
        size: response.size, transferred: response.transferred, totalTransferred: response.totalTransferred,
        responseTime: response.responseTime,
        xRobotsTag: response.xRobotsTag || '',
        robotsTxtStatus: robotsResult.status,
        robotsTxtDirective: robotsResult.directive,
        indexabilityFinal, indexabilityReason, ...parsedData
      }
    };
  } catch (error) {
    return { success: false, error: error.message };
  }
});

// クローラーの制御
ipcMain.handle('start-crawl', async (event, url, options) => {
  // URLのバリデーション
  const urlsToValidate = Array.isArray(url) ? url : [url];
  for (const u of urlsToValidate) {
    if (!isValidHttpUrl(u)) {
      return { success: false, error: 'Invalid URL protocol. Only http: and https: are allowed.' };
    }
  }

  try {
    if (crawlManagerInstance) {
      crawlManagerInstance.clear();
      crawlManagerInstance.removeAllListeners();
    }
    
    const { CrawlManager } = await import('./src/crawler/crawlManager.js');
    crawlManagerInstance = new CrawlManager(options);
    
    let finalUrls = url;
    // Sitemap URL in List mode
    if (options.mode === 'list' && Array.isArray(url) && url.length === 1 && url[0].endsWith('.xml')) {
      const { fetchUrl } = await import('./src/crawler/fetcher.js');
      const { parseSitemap } = await import('./src/utils/sitemapParser.js');
      const sitemapResponse = await fetchUrl(url[0], options.auth);
      if (sitemapResponse.success) {
        finalUrls = parseSitemap(sitemapResponse.html); // xml string is stored in html prop
        if (finalUrls.length === 0) {
           throw new Error('No valid URLs found in the sitemap.');
        }
      } else {
        throw new Error('Failed to fetch sitemap: ' + (sitemapResponse.error || sitemapResponse.status));
      }
    }
    
    // イベントリスナーの登録
    crawlManagerInstance.on('url-processed', (data) => {
      if (mainWindow && !mainWindow.isDestroyed()) {
        mainWindow.webContents.send('crawl-progress', data);
      }
    });
    
    crawlManagerInstance.on('crawl-error', (data) => {
      if (mainWindow && !mainWindow.isDestroyed()) {
        mainWindow.webContents.send('crawl-error', data);
      }
    });

    // 非同期で開始（awaitで待たずにすぐフロントエンドに制御を返す）
    crawlManagerInstance.start(finalUrls).then(results => {
      if (mainWindow && !mainWindow.isDestroyed()) {
        mainWindow.webContents.send('crawl-complete', { success: true, count: results.length });
      }
    }).catch(error => {
      if (mainWindow && !mainWindow.isDestroyed()) {
        mainWindow.webContents.send('crawl-complete', { success: false, error: error.message });
      }
    });
    
    return { success: true };
  } catch (error) {
    return { success: false, error: error.message };
  }
});

ipcMain.handle('pause-crawl', () => {
  if (crawlManagerInstance) crawlManagerInstance.pause();
  return { success: true };
});

ipcMain.handle('resume-crawl', () => {
  if (crawlManagerInstance) crawlManagerInstance.resume();
  return { success: true };
});

ipcMain.handle('stop-crawl', () => {
  if (crawlManagerInstance) {
    crawlManagerInstance.clear();
    if (mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.webContents.send('crawl-complete', { success: true, count: crawlManagerInstance.results.length, stopped: true });
    }
  }
  return { success: true };
});

ipcMain.handle('export-csv', async (event, data) => {
  try {
    const { canceled, filePath } = await dialog.showSaveDialog(mainWindow, {
      title: 'CSVエクスポート',
      defaultPath: 'seo_report.csv',
      filters: [{ name: 'CSV Files', extensions: ['csv'] }]
    });

    if (canceled || !filePath) {
      return { success: false, canceled: true };
    }

    const { exportToCsv } = await import('./src/exporters/csvExporter.js');
    await exportToCsv(data, filePath);

    return { success: true, filePath };
  } catch (error) {
    return { success: false, error: error.message };
  }
});


// --- 以下、右クリックメニューおよび左クリック計画でも共用するハンドラー ---

// 外部ブラウザでURLを開く
try {
  ipcMain.handle('open-external', async (event, url) => {
    if (url) {
      try {
        const parsedUrl = new URL(url);
        if (['http:', 'https:'].includes(parsedUrl.protocol)) {
          await shell.openExternal(parsedUrl.href);
        } else {
          console.warn(`Blocked attempt to open external URL with unsafe protocol: ${parsedUrl.protocol}`);
        }
      } catch (e) {
        console.error('Invalid URL provided to open-external:', url);
      }
    }
  });
} catch (e) {
  console.warn('IPC handler "open-external" is already registered.');
}

// クリップボードにテキストをコピー（Electronのclipboardモジュールを使用）
try {
  ipcMain.handle('copy-to-clipboard', (event, text) => {
    if (text) clipboard.writeText(text);
  });
} catch (e) {
  console.warn('IPC handler "copy-to-clipboard" is already registered.');
}
