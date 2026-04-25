// detailView.js
import { getColumnsInfo } from './grid.js';

const detailView = document.getElementById('detail-view');
const detailContent = document.getElementById('detail-content');
const placeholder = detailView.querySelector('.detail-placeholder');
const contextMenu = document.getElementById('detail-context-menu');
const menuCopy = document.getElementById('menu-copy');
const menuOpenUrl = document.getElementById('menu-open-url');

let currentContextData = { value: '', field: '' };

/**
 * 指定された行のデータを詳細ビューに表示する
 * @param {Object} rowData - Tabulatorの行データ
 */
export function showDetail(rowData) {
  if (!rowData) {
    placeholder.classList.remove('hidden');
    detailContent.innerHTML = '';
    return;
  }

  placeholder.classList.add('hidden');
  detailView.classList.remove('hidden');
  
  const columns = getColumnsInfo();
  detailContent.innerHTML = '';

  columns.forEach(col => {
    const field = col.field;
    const title = col.title;
    const value = rowData[field] !== undefined ? rowData[field] : '';

    const row = document.createElement('div');
    row.className = 'detail-row';
    
    const label = document.createElement('div');
    label.className = 'detail-label';
    label.textContent = title;

    const valDiv = document.createElement('div');
    valDiv.className = 'detail-value';
    valDiv.textContent = value;

    row.appendChild(label);
    row.appendChild(valDiv);

    // 右クリックイベント：詳細ビュー内のみで動作
    row.addEventListener('contextmenu', (e) => {
      e.preventDefault();
      e.stopPropagation(); // グリッド側への伝播を防止
      showContextMenu(e.pageX, e.pageY, value, field);
    });

    detailContent.appendChild(row);
  });
}

/**
 * カスタムコンテキストメニューを表示する
 */
function showContextMenu(x, y, value, field) {
  currentContextData = { value, field };

  contextMenu.style.left = `${x}px`;
  contextMenu.style.top = `${y}px`;
  contextMenu.classList.remove('hidden');

  // URL系フィールドの場合は「ブラウザで開く」を表示
  if (field === 'address' || field === 'canonicalLink') {
    menuOpenUrl.classList.remove('hidden');
  } else {
    menuOpenUrl.classList.add('hidden');
  }
}

// 画面クリックでコンテキストメニューを閉じる
document.addEventListener('click', (e) => {
  if (!contextMenu.contains(e.target)) {
    contextMenu.classList.add('hidden');
  }
});

// コピーアクション
menuCopy.addEventListener('click', () => {
  if (currentContextData.value !== undefined) {
    // 計画書に基づき window.api.copyToClipboard を使用
    window.api.copyToClipboard(String(currentContextData.value));
  }
  contextMenu.classList.add('hidden');
});

// URLを開くアクション
menuOpenUrl.addEventListener('click', () => {
  if (currentContextData.value) {
    window.api.openExternal(String(currentContextData.value));
  }
  contextMenu.classList.add('hidden');
});
