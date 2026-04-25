import fs from 'fs';
import path from 'path';
import os from 'os';
import { exportToCsv } from '../src/exporters/csvExporter.js';

describe('csvExporter', () => {
  let tempFilePath;

  beforeEach(() => {
    tempFilePath = path.join(os.tmpdir(), `test-${Date.now()}.csv`);
  });

  afterEach(() => {
    if (fs.existsSync(tempFilePath)) {
      fs.unlinkSync(tempFilePath);
    }
  });

  it('should export data to a CSV file with BOM', async () => {
    const data = [
      { address: 'http://example.com', statusCode: 200, title: 'テスト' },
      { address: 'http://example.com/2', statusCode: 404, title: 'Not Found' }
    ];

    await exportToCsv(data, tempFilePath);

    expect(fs.existsSync(tempFilePath)).toBe(true);

    const content = fs.readFileSync(tempFilePath, 'utf8');
    // Check BOM
    expect(content.charCodeAt(0)).toBe(0xFEFF);
    
    // Check headers and data
    expect(content).toContain('address,contentType,statusCode');
    expect(content).toContain('http://example.com');
    expect(content).toContain('テスト');
  });

  it('should reject if data is empty', async () => {
    await expect(exportToCsv([], tempFilePath)).rejects.toThrow('Export data is empty');
  });
});
