// grid.js

let table = null;
let onRowClickCallback = null;

export function setOnRowClick(callback) {
  onRowClickCallback = callback;
}

export function initGrid(containerSelector) {
  table = new Tabulator(containerSelector, {
    height: "100%", // Fit container
    layout: "fitDataFill",
    virtualDom: true, // IMPORTANT: Virtual scrolling for performance
    columns: [
      { title: "Address", field: "address", width: 300, frozen: true },
      { title: "Status Code", field: "statusCode", width: 100 },
      { title: "Status", field: "status", width: 120 },
      { title: "Indexability Final", field: "indexabilityFinal", width: 150 },
      { title: "Indexability Reason", field: "indexabilityReason", width: 200 },
      { title: "Title", field: "title", width: 250 },
      { title: "Response Time (ms)", field: "responseTime", width: 150, hozAlign: "right" },
      { title: "Size (bytes)", field: "size", width: 100, hozAlign: "right" },
      
      // Fields hidden by default for better visibility
      { title: "Content Type", field: "contentType", width: 120, visible: false },
      { title: "Robots Txt Status", field: "robotsTxtStatus", width: 150, visible: false },
      { title: "Robots Txt Directive", field: "robotsTxtDirective", width: 200, visible: false },
      { title: "X-Robots-Tag", field: "xRobotsTag", width: 150, visible: false },
      { title: "Meta Robots Index", field: "metaRobotsIndex", width: 150, visible: false },
      { title: "Meta Robots Follow", field: "metaRobotsFollow", width: 150, visible: false },
      { title: "Meta Robots Raw", field: "metaRobotsRaw", width: 200, visible: false },
      { title: "Meta Description", field: "metaDescription", width: 250, visible: false },
      { title: "Meta Keywords", field: "metaKeywords", width: 150, visible: false },
      { title: "H1-1", field: "h1_1", width: 150, visible: false },
      { title: "H1-2", field: "h1_2", width: 150, visible: false },
      { title: "H2-1", field: "h2_1", width: 150, visible: false },
      { title: "H2-2", field: "h2_2", width: 150, visible: false },
      { title: "H2-3", field: "h2_3", width: 150, visible: false },
      { title: "Canonical Link", field: "canonicalLink", width: 200, visible: false },
      { title: "Transferred", field: "transferred", width: 100, visible: false },
      { title: "Total Transferred", field: "totalTransferred", width: 120, visible: false },

      // New columns for links and structures
      { title: "Internal Link Count", field: "internalLinkCount", width: 120, visible: false, hozAlign: "right" },
      { title: "External Link Count", field: "externalLinkCount", width: 120, visible: false, hozAlign: "right" },
      { title: "Internal Nofollow Count", field: "internalNofollowCount", width: 130, visible: false, hozAlign: "right" },
      { title: "External Nofollow Count", field: "externalNofollowCount", width: 130, visible: false, hozAlign: "right" },
      { title: "Internal Link URLs", field: "internalLinkUrls", width: 200, visible: false },
      { title: "External Link URLs", field: "externalLinkUrls", width: 200, visible: false },
      { title: "Internal Anchor Texts", field: "internalAnchorTexts", width: 200, visible: false },
      { title: "External Anchor Texts", field: "externalAnchorTexts", width: 200, visible: false },
      { title: "Internal Link Unique Count", field: "internalLinkUniqueCount", width: 150, visible: false, hozAlign: "right" },
      { title: "External Link Unique Count", field: "externalLinkUniqueCount", width: 150, visible: false, hozAlign: "right" },
      { title: "Self Link Count", field: "selfLinkCount", width: 120, visible: false, hozAlign: "right" },
      { title: "Has Breadcrumb Link", field: "hasBreadcrumbLink", width: 120, visible: false },
      { title: "Link To Top Page", field: "linkToTopPage", width: 120, visible: false },
      { title: "Link Depth Estimate", field: "linkDepthEstimate", width: 120, visible: false, hozAlign: "right" },
      // Structured Data Fields
      { title: "SD Exists", field: "structuredDataExists", width: 100, visible: false },
      { title: "SD Count", field: "structuredDataCount", width: 100, visible: false },
      { title: "SD Types", field: "structuredDataTypes", width: 200, visible: false },
      { title: "SD JSON-LD Count", field: "structuredDataJsonLdCount", width: 120, visible: false },
      { title: "SD Microdata Count", field: "structuredDataMicrodataCount", width: 140, visible: false },
      { title: "SD RDFa Count", field: "structuredDataRdfaCount", width: 120, visible: false },
      { title: "SD Invalid Count", field: "structuredDataInvalidCount", width: 120, visible: false },
      { title: "SD Primary Type", field: "structuredDataPrimaryType", width: 150, visible: false },
      { title: "Has Breadcrumb", field: "hasBreadcrumbList", width: 120, visible: false },
      { title: "Has FAQ", field: "hasFAQ", width: 100, visible: false },
      { title: "Has Article", field: "hasArticle", width: 100, visible: false },
      { title: "Has Product", field: "hasProduct", width: 100, visible: false },
      { title: "Has Organization", field: "hasOrganization", width: 130, visible: false },
    ],
    rowContextMenu: [
      {
        label: "URLをコピー",
        action: function(e, row) {
          const url = row.getData().address;
          if (url) window.api.copyToClipboard(url);
        }
      },
      {
        label: "デフォルトブラウザで開く",
        action: function(e, row) {
          const url = row.getData().address;
          if (url) window.api.openExternal(url);
        }
      },
    ],
  });

  table.on("rowClick", function(e, row) {
    if (onRowClickCallback) {
      onRowClickCallback(row.getData());
    }
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

