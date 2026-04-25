import { initGrid, addRow, clearGrid, getData, getColumnsInfo, toggleColumnVisibility, setMediaTypeFilter, setOnRowClick } from './grid.js';
import { showDetail } from './detailView.js';

document.addEventListener('DOMContentLoaded', () => {
  initGrid("#data-grid");
  setOnRowClick(showDetail);

  const btnStart = document.getElementById('btn-start');
  const btnPause = document.getElementById('btn-pause');
  const btnStop = document.getElementById('btn-stop');
  const btnExport = document.getElementById('btn-export');
  const modeRadios = document.getElementsByName('crawl-mode');
  const urlInput = document.getElementById('url-input');
  const listInput = document.getElementById('list-input');
  const concurrencyInput = document.getElementById('concurrency-input');
  const authUsernameInput = document.getElementById('auth-username');
  const authPasswordInput = document.getElementById('auth-password');
  const statusText = document.getElementById('status-text');
  const progressText = document.getElementById('progress-text');
  const progressBar = document.getElementById('progress-bar');
  const filterMediaSelect = document.getElementById('filter-media');

  let isPaused = false;

  // フィルターの設定
  filterMediaSelect.addEventListener('change', (e) => {
    setMediaTypeFilter(e.target.value);
  });

  // リスナーをクリーンアップして再登録
  if (window.api.removeAllCrawlListeners) {
    window.api.removeAllCrawlListeners();
  }

  // カラムパネルの設定
  const btnColumns = document.getElementById('btn-columns');
  const columnPanel = document.getElementById('column-panel');

  const setupColumnPanel = () => {
    columnPanel.innerHTML = '';
    const columns = getColumnsInfo();
    
    columns.forEach(col => {
      const label = document.createElement('label');
      label.className = 'column-panel-item';
      
      const checkbox = document.createElement('input');
      checkbox.type = 'checkbox';
      checkbox.checked = col.visible;
      // Address等の固定カラムは非表示操作を不可にする
      if (col.frozen) {
        checkbox.disabled = true;
      }
      
      checkbox.addEventListener('change', (e) => {
        toggleColumnVisibility(col.field, e.target.checked);
      });
      
      label.appendChild(checkbox);
      label.appendChild(document.createTextNode(col.title));
      columnPanel.appendChild(label);
    });
  };

  btnColumns.addEventListener('click', () => {
    if (columnPanel.classList.contains('hidden')) {
      setupColumnPanel();
      columnPanel.classList.remove('hidden');
    } else {
      columnPanel.classList.add('hidden');
    }
  });

  // パネル外クリックで閉じる
  document.addEventListener('click', (e) => {
    if (!btnColumns.contains(e.target) && !columnPanel.contains(e.target)) {
      columnPanel.classList.add('hidden');
    }
  });

  // UI状態の更新関数
  const updateUIState = (running, paused = false) => {
    isPaused = paused;
    btnStart.disabled = running;
    urlInput.disabled = running;
    listInput.disabled = running;
    concurrencyInput.disabled = running;
    authUsernameInput.disabled = running;
    authPasswordInput.disabled = running;
    modeRadios.forEach(radio => radio.disabled = running);
    
    if (running) {
      if (paused) {
        btnPause.textContent = 'Resume';
        btnPause.disabled = false;
        statusText.textContent = 'Paused';
      } else {
        btnPause.textContent = 'Pause';
        btnPause.disabled = false;
        statusText.textContent = 'Crawling...';
      }
      btnStop.disabled = false;
    } else {
      btnPause.disabled = true;
      btnStop.disabled = true;
      btnPause.textContent = 'Pause';
      btnExport.disabled = false;
    }
  };

  // モード切替のUI反映
  modeRadios.forEach(radio => {
    radio.addEventListener('change', (e) => {
      if (e.target.value === 'list') {
        urlInput.classList.add('hidden');
        listInput.classList.remove('hidden');
      } else {
        urlInput.classList.remove('hidden');
        listInput.classList.add('hidden');
      }
    });
  });

  btnStart.addEventListener('click', async () => {
    const selectedMode = Array.from(modeRadios).find(r => r.checked)?.value || 'spider';
    let targetUrls = '';

    if (selectedMode === 'spider') {
      targetUrls = urlInput.value.trim();
      if (!targetUrls) {
        alert("Please enter a valid URL.");
        return;
      }
    } else {
      const listText = listInput.value.trim();
      if (!listText) {
        alert("Please enter URLs or a sitemap URL.");
        return;
      }
      // 改行で分割して空行を除外
      targetUrls = listText.split('\n').map(l => l.trim()).filter(l => l.length > 0);
    }
    
    const concurrency = parseInt(concurrencyInput.value, 10) || 5;
    const authUsername = authUsernameInput.value.trim();
    const authPassword = authPasswordInput.value.trim();
    
    const options = { concurrency, mode: selectedMode };
    if (authUsername && authPassword) {
      options.auth = { username: authUsername, password: authPassword };
    }

    updateUIState(true, false);
    btnExport.disabled = true;
    clearGrid();
    showDetail(null);
    
    progressBar.style.width = '0%';
    progressText.textContent = '0 / 0';

    try {
      const response = await window.api.startCrawl(targetUrls, options);
      if (!response.success) {
        updateUIState(false);
        statusText.textContent = `Error: ${response.error}`;
        alert(`Failed to start crawler:\n${response.error}`);
      }
    } catch (error) {
      console.error(error);
      updateUIState(false);
      statusText.textContent = "IPC Error";
    }
  });

  btnPause.addEventListener('click', async () => {
    if (isPaused) {
      // Resume
      await window.api.resumeCrawl();
      updateUIState(true, false);
    } else {
      // Pause
      await window.api.pauseCrawl();
      updateUIState(true, true);
    }
  });

  btnStop.addEventListener('click', async () => {
    await window.api.stopCrawl();
    updateUIState(false);
    statusText.textContent = 'Stopped';
  });

  btnExport.addEventListener('click', async () => {
    const data = getData();
    if (data.length === 0) {
      alert('No data to export.');
      return;
    }

    try {
      const response = await window.api.exportCsv(data);
      if (response.success) {
        alert(`Exported successfully to:\n${response.filePath}`);
      } else if (!response.canceled) {
        alert(`Failed to export:\n${response.error}`);
      }
    } catch (error) {
      console.error(error);
      alert('IPC Error during export.');
    }
  });

  // アクセシビリティ：ショートカットキー
  urlInput.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' && !btnStart.disabled) {
      btnStart.click();
    }
  });

  listInput.addEventListener('keydown', (e) => {
    if (e.ctrlKey && e.key === 'Enter' && !btnStart.disabled) {
      btnStart.click();
    }
  });

  // イベントリスナー
  if (window.api.onCrawlProgress) {
    window.api.onCrawlProgress((data) => {
      const { result, visitedCount, queueCount, pendingCount } = data;
      
      addRow(result);
      
      const totalDiscovered = visitedCount + queueCount;
      const progressPercent = totalDiscovered > 0 ? (visitedCount / totalDiscovered) * 100 : 0;
      
      progressBar.style.width = `${progressPercent}%`;
      progressText.textContent = `${visitedCount} / ${totalDiscovered} (Queued: ${queueCount})`;
    });
  }

  if (window.api.onCrawlComplete) {
    window.api.onCrawlComplete((data) => {
      updateUIState(false);
      progressBar.style.width = '100%';
      
      if (data.stopped) {
        statusText.textContent = `Stopped. Fetched ${data.count} pages.`;
      } else if (data.success) {
        statusText.textContent = `Completed! Fetched ${data.count} pages.`;
      } else {
        statusText.textContent = `Error: ${data.error}`;
      }
    });
  }

  // クロール中の個別URLエラーを受信し、ステータスバーに表示する
  if (window.api.onCrawlError) {
    window.api.onCrawlError((data) => {
      console.error('Crawl error:', data.url, data.error);
      statusText.textContent = `Error on: ${data.url} — ${data.error}`;
    });
  }
});
