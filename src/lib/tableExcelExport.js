import ExcelJS from 'exceljs';

function sanitizeFileName(name) {
  return String(name || 'export')
    .replace(/[\\/:*?"<>|]/g, '-')
    .slice(0, 80);
}

function cellValue(v) {
  if (v == null || v === '') return '';
  if (typeof v === 'boolean') return v ? 'Có' : 'Không';
  if (typeof v === 'number' && Number.isFinite(v)) return v;
  return String(v);
}

/**
 * Xuất bảng đơn giản ra .xlsx
 * @param {object} opts
 * @param {string} opts.fileName — không kèm .xlsx
 * @param {string} [opts.sheetName]
 * @param {string} [opts.title]
 * @param {Array<{ header: string, key?: string, accessor?: (row: object) => unknown, width?: number }>} opts.columns
 * @param {Array<object>} opts.rows
 */
export async function downloadTableExcel({ fileName, sheetName = 'Dữ liệu', title, columns, rows }) {
  const wb = new ExcelJS.Workbook();
  const ws = wb.addWorksheet(String(sheetName).slice(0, 31));

  if (title) {
    const tRow = ws.addRow([title]);
    ws.mergeCells(1, 1, 1, Math.max(columns.length, 1));
    tRow.font = { bold: true, size: 12 };
    ws.addRow([]);
  }

  const headerRow = ws.addRow(columns.map((c) => c.header));
  headerRow.height = 20;
  headerRow.eachCell((cell) => {
    cell.font = { bold: true, size: 10, color: { argb: 'FF1F2937' } };
    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF3F4F6' } };
    cell.alignment = { vertical: 'middle', horizontal: 'center', wrapText: true };
    cell.border = {
      top: { style: 'thin', color: { argb: 'FFD1D5DB' } },
      left: { style: 'thin', color: { argb: 'FFD1D5DB' } },
      bottom: { style: 'thin', color: { argb: 'FFD1D5DB' } },
      right: { style: 'thin', color: { argb: 'FFD1D5DB' } },
    };
  });

  for (const row of rows || []) {
    const vals = columns.map((col) => {
      const raw = col.accessor ? col.accessor(row) : row[col.key];
      return cellValue(raw);
    });
    ws.addRow(vals);
  }

  columns.forEach((col, i) => {
    const letter = ws.getColumn(i + 1);
    letter.width = Math.min(32, Math.max(8, Number(col.width) || String(col.header || '').length + 4));
  });

  const buf = await wb.xlsx.writeBuffer();
  const blob = new Blob([buf], {
    type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = `${sanitizeFileName(fileName)}.xlsx`;
  a.click();
  URL.revokeObjectURL(a.href);
}
