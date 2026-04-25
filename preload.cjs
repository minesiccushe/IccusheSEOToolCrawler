const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('api', {
  fetchUrl: (url) => ipcRenderer.invoke('fetch-url', url), // Phase 2互換用
  startCrawl: (url, options) => ipcRenderer.invoke('start-crawl', url, options),
  pauseCrawl: () => ipcRenderer.invoke('pause-crawl'),
  resumeCrawl: () => ipcRenderer.invoke('resume-crawl'),
  stopCrawl: () => ipcRenderer.invoke('stop-crawl'),
  onCrawlProgress: (callback) => ipcRenderer.on('crawl-progress', (_event, data) => callback(data)),
  onCrawlComplete: (callback) => ipcRenderer.on('crawl-complete', (_event, data) => callback(data)),
  onCrawlError: (callback) => ipcRenderer.on('crawl-error', (_event, data) => callback(data)),
  exportCsv: (data) => ipcRenderer.invoke('export-csv', data),
  removeAllCrawlListeners: () => {
    ipcRenderer.removeAllListeners('crawl-progress');
    ipcRenderer.removeAllListeners('crawl-complete');
    ipcRenderer.removeAllListeners('crawl-error');
  }
});
