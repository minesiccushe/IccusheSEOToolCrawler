import fs from 'fs';
import { stringify } from 'csv-stringify';

/**
 * データをCSVファイルとしてエクスポートする
 * @param {Array<Object>} data - エクスポートするデータの配列
 * @param {string} filePath - 保存先のファイルパス
 * @returns {Promise<void>}
 */
export function exportToCsv(data, filePath) {
  return new Promise((resolve, reject) => {
    if (!data || data.length === 0) {
      return reject(new Error('Export data is empty'));
    }

    // 抽出するカラムの定義
    const columns = [
      'address', 'contentType', 'statusCode', 'status', 'indexability', 'indexabilityStatus',
      'title', 'metaDescription', 'metaKeywords', 'h1_1', 'h1_2', 'h2_1', 'h2_2', 'h2_3',
      'metaRobots', 'canonicalLink', 'size', 'transferred', 'totalTransferred', 'responseTime',
      'structuredDataExists', 'structuredDataCount', 'structuredDataTypes', 'structuredDataJsonLdCount',
      'structuredDataMicrodataCount', 'structuredDataRdfaCount', 'structuredDataInvalidCount',
      'structuredDataPrimaryType', 'hasBreadcrumbList', 'hasFAQ', 'hasArticle', 'hasProduct', 'hasOrganization'
    ];

    stringify(data, {
      header: true,
      columns: columns,
      cast: {
        boolean: function(value) {
          return value ? 'true' : 'false';
        }
      }
    }, (err, output) => {
      if (err) {
        return reject(err);
      }
      
      // UTF-8 with BOM で保存（Excel等での文字化け防止）
      const bom = '\ufeff';
      fs.writeFile(filePath, bom + output, 'utf8', (writeErr) => {
        if (writeErr) {
          return reject(writeErr);
        }
        resolve();
      });
    });
  });
}
