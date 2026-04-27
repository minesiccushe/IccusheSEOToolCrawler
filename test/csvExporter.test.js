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

  it('should convert boolean values to strings "true" and "false"', async () => {
    const data = [
      { address: 'http://example.com', hasMultipleH1: true, missingH1: false },
      { address: 'http://example.com/2', hasMultipleH1: false, missingH1: true }
    ];

    await exportToCsv(data, tempFilePath);

    expect(fs.existsSync(tempFilePath)).toBe(true);

    const content = fs.readFileSync(tempFilePath, 'utf8');

    // Check that booleans are converted correctly in the CSV output
    expect(content).toContain('http://example.com,');
    expect(content).toContain('true,false'); // for the first row (depends on columns order but they are next to each other in output if columns list specifies them so we check carefully)

    // Check specific columns - hasMultipleH1 and missingH1 are adjacent in columns array:
    // 'hasMultipleH1', 'missingH1', 'headingOrderValid'
    // So 'true,false' and 'false,true' should be present.
    expect(content).toMatch(/true,false/);
    expect(content).toMatch(/false,true/);
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
