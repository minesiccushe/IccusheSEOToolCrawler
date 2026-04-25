// grid.js

let table = null;

export function initGrid(containerSelector) {
  table = new Tabulator(containerSelector, {
    height: "100%", // Fit container
    layout: "fitDataFill",
    virtualDom: true, // IMPORTANT: Virtual scrolling for performance
    columns: [
      { title: "Address", field: "address", width: 300, frozen: true },
      { title: "Status Code", field: "statusCode", width: 100 },
      { title: "Status", field: "status", width: 120 },
      { title: "Indexability", field: "indexability", width: 120 },
      { title: "Indexability Status", field: "indexabilityStatus", width: 150 },
      { title: "Title", field: "title", width: 250 },
      { title: "Response Time (ms)", field: "responseTime", width: 150, hozAlign: "right" },
      { title: "Size (bytes)", field: "size", width: 100, hozAlign: "right" },
      
      // Fields hidden by default for better visibility
      { title: "Content Type", field: "contentType", width: 120, visible: false },
      { title: "Meta Description", field: "metaDescription", width: 250, visible: false },
      { title: "Meta Keywords", field: "metaKeywords", width: 150, visible: false },
      { title: "H1-1", field: "h1_1", width: 150, visible: false },
      { title: "H1-2", field: "h1_2", width: 150, visible: false },
      { title: "H2-1", field: "h2_1", width: 150, visible: false },
      { title: "H2-2", field: "h2_2", width: 150, visible: false },
      { title: "H2-3", field: "h2_3", width: 150, visible: false },
      { title: "Meta Robots", field: "metaRobots", width: 150, visible: false },
      { title: "Canonical Link", field: "canonicalLink", width: 200, visible: false },
      { title: "Transferred", field: "transferred", width: 100, visible: false },
      { title: "Total Transferred", field: "totalTransferred", width: 120, visible: false },
    ],
  });
}

export function addRow(data) {
  if (table) {
    table.addRow(data);
  }
}

export function clearGrid() {
  if (table) {
    table.clearData();
  }
}

export function getData() {
  if (table) {
    return table.getData();
  }
  return [];
}

export function getColumnsInfo() {
  if (!table) return [];
  const columns = table.getColumns();
  return columns.map(col => {
    const def = col.getDefinition();
    return {
      field: def.field,
      title: def.title,
      visible: col.isVisible(),
      frozen: def.frozen || false
    };
  });
}

export function toggleColumnVisibility(field, visible) {
  if (!table) return;
  const col = table.getColumn(field);
  if (col) {
    if (visible) {
      col.show();
    } else {
      col.hide();
    }
  }
}

/**
 * メディアタイプによるフィルタリングを設定する
 * @param {string} mediaType - 'all', 'html', 'image', 'pdf', 'other'
 */
export function setMediaTypeFilter(mediaType) {
  if (!table) return;
  
  // 既存のフィルタをクリア
  table.clearFilter();
  
  if (mediaType === 'all') {
    return; // 全表示
  }
  
  // カスタムフィルタ関数の適用
  table.setFilter(function(data) {
    const cType = (data.contentType || '').toLowerCase();
    switch (mediaType) {
      case 'html':
        return cType.includes('text/html');
      case 'image':
        return cType.includes('image/');
      case 'pdf':
        return cType.includes('application/pdf');
      case 'other':
        // HTML, Image, PDF 以外のすべて
        return !cType.includes('text/html') && 
               !cType.includes('image/') && 
               !cType.includes('application/pdf');
      default:
        return true;
    }
  });
}

