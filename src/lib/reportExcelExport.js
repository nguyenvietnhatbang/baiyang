/**
 * Xuất báo cáo ra Excel (.xlsx) với định dạng cơ bản (tiêu đề, header màu, viền, số có phân tách nghìn).
 * Dùng ExcelJS — khi mở bằng Excel/LibreOffice vẫn có thể chỉnh theme/font theo ứng dụng.
 */

import ExcelJS from 'exceljs';
import { originalHarvestDateForReport } from '@/lib/planReportHelpers';
import { classifyHarvestStatus, harvestStatusLabel } from '@/lib/harvestAlerts';

const MONTHS = Array.from({ length: 12 }, (_, i) => `T${i + 1}`);

function calcOriginalYield(p) {
  if (!p?.total_fish || !p?.survival_rate || !p?.target_weight) return 0;
  return Math.round((p.total_fish * (p.survival_rate / 100) * p.target_weight) / 1000);
}

function pondActualYield(p, harvests) {
  return harvests
    .filter((h) => h.pond_code === p.code || h.pond_id === p.id)
    .reduce((s, h) => s + (h.actual_yield || 0), 0);
}

function diffPct(original, adjusted) {
  if (!original || !adjusted) return null;
  const d = adjusted - original;
  if (d === 0) return 0;
  return Math.round((d / original) * 100);
}

function styleTitleRow(row, ncol) {
  const sheet = row.worksheet;
  if (ncol > 1) {
    sheet.mergeCells(1, 1, 1, ncol);
  }
  row.font = { bold: true, size: 14, color: { argb: 'FF1F4E79' } };
  row.alignment = { vertical: 'middle', horizontal: 'left' };
  row.height = 24;
  row.eachCell({ includeEmpty: true }, (cell) => {
    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFD9E2F3' } };
  });
}

function styleFilterRow(row, ncol) {
  const sheet = row.worksheet;
  if (ncol > 1) {
    sheet.mergeCells(2, 1, 2, ncol);
  }
  row.font = { size: 10, italic: true, color: { argb: 'FF404040' } };
  row.alignment = { vertical: 'middle', horizontal: 'left', wrapText: true };
}

function styleHeaderRow(row) {
  row.height = 28;
  row.eachCell((cell, colNumber) => {
    cell.font = { bold: true, size: 10, color: { argb: 'FFFFFFFF' } };
    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF2F5597' } };
    cell.alignment = {
      vertical: 'middle',
      horizontal: colNumber === 1 ? 'left' : 'center',
      wrapText: true,
    };
    cell.border = {
      top: { style: 'thin', color: { argb: 'FF000000' } },
      left: { style: 'thin', color: { argb: 'FF000000' } },
      bottom: { style: 'thin', color: { argb: 'FF000000' } },
      right: { style: 'thin', color: { argb: 'FF000000' } },
    };
  });
}

function styleBodyRow(row, { isTotal = false, zebra = false } = {}) {
  row.eachCell((cell) => {
    cell.border = {
      top: { style: 'hair', color: { argb: 'FFCCCCCC' } },
      left: { style: 'hair', color: { argb: 'FFCCCCCC' } },
      bottom: { style: 'hair', color: { argb: 'FFCCCCCC' } },
      right: { style: 'hair', color: { argb: 'FFCCCCCC' } },
    };
    if (isTotal) {
      cell.font = { bold: true };
      cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFE7EEF7' } };
    } else if (zebra) {
      cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF8FAFC' } };
    }
  });
}

function applyNumberFormats(row, formats) {
  formats.forEach((fmt, i) => {
    if (!fmt) return;
    const cell = row.getCell(i + 1);
    if (cell.value != null && cell.value !== '' && typeof cell.value === 'number') {
      cell.numFmt = fmt;
    }
  });
}

function setColumnWidths(sheet, widths) {
  widths.forEach((w, i) => {
    if (w) sheet.getColumn(i + 1).width = w;
  });
}

function addSheetCommonTop(sheet, { title, filterLine, headers }) {
  const ncol = headers.length;
  sheet.addRow([title]);
  styleTitleRow(sheet.getRow(1), ncol);
  sheet.addRow([filterLine]);
  styleFilterRow(sheet.getRow(2), ncol);
  sheet.addRow([]);
  const hr = sheet.addRow(headers);
  styleHeaderRow(hr);
  return { headerRowIndex: 4, ncol };
}

function finalizeSheetView(sheet, headerRowIndex) {
  sheet.views = [{ state: 'frozen', ySplit: headerRowIndex, topLeftCell: `A${headerRowIndex + 1}` }];
}

/** --- Builders --- */

function buildOriginal(sheet, { granularity, ponds, agencies, filterLine }) {
  const title = 'Kế hoạch ban đầu (gốc)';
  if (granularity === 'agency') {
    const headers = ['Đại lý', 'Số ao CC', 'Số ao CT', 'Tổng ao', 'KH CC (kg)', 'KH CT (kg)', 'KH Tổng (kg)', ...MONTHS];
    addSheetCommonTop(sheet, { title, filterLine, headers });
    const numFmt = ['', '', '', '', '#,##0', '#,##0', '#,##0', ...MONTHS.map(() => '#,##0')];
    agencies.forEach((agency, idx) => {
      const ap = ponds.filter((p) => p.agency_code === agency);
      const cc = ap.filter((p) => p.status === 'CC');
      const ct = ap.filter((p) => p.status === 'CT');
      const totalCC = cc.reduce((s, p) => s + calcOriginalYield(p), 0);
      const totalCT = ct.reduce((s, p) => s + calcOriginalYield(p), 0);
      const totalAll = totalCC + totalCT;
      const monthVals = MONTHS.map((_, i) => {
        const vcc = cc.reduce((s, p) => {
          const d = originalHarvestDateForReport(p);
          return s + (d && new Date(d).getMonth() === i ? calcOriginalYield(p) : 0);
        }, 0);
        const vct = ct.reduce((s, p) => {
          const d = originalHarvestDateForReport(p);
          return s + (d && new Date(d).getMonth() === i ? calcOriginalYield(p) : 0);
        }, 0);
        return vcc + vct;
      });
      const row = sheet.addRow([agency, cc.length, ct.length, ap.length, totalCC, totalCT, totalAll, ...monthVals]);
      applyNumberFormats(row, numFmt);
      styleBodyRow(row, { zebra: idx % 2 === 1 });
    });
    const grandCC = ponds.filter((p) => p.status === 'CC').length;
    const grandCT = ponds.filter((p) => p.status === 'CT').length;
    const gCCkg = ponds.filter((p) => p.status === 'CC').reduce((s, p) => s + calcOriginalYield(p), 0);
    const gCTkg = ponds.filter((p) => p.status === 'CT').reduce((s, p) => s + calcOriginalYield(p), 0);
    const gAll = gCCkg + gCTkg;
    const gMonths = MONTHS.map((_, i) =>
      ponds.reduce((s, p) => {
        const d = originalHarvestDateForReport(p);
        return s + (d && new Date(d).getMonth() === i ? calcOriginalYield(p) : 0);
      }, 0)
    );
    const totalRow = sheet.addRow(['TỔNG CỘNG', grandCC, grandCT, ponds.length, gCCkg, gCTkg, gAll, ...gMonths]);
    applyNumberFormats(totalRow, numFmt);
    styleBodyRow(totalRow, { isTotal: true });
    setColumnWidths(sheet, [22, 10, 10, 10, 14, 14, 14, ...MONTHS.map(() => 11)]);
  } else {
    const headers = [
      'Đại lý',
      'Mã ao',
      'Chủ hộ',
      'Diện tích (m²)',
      'TT',
      'KH CC (kg)',
      'KH CT (kg)',
      'KH Tổng (kg)',
      'Ngày thu KH (gốc)',
      ...MONTHS,
    ];
    addSheetCommonTop(sheet, { title, filterLine, headers });
    const sorted = [...ponds].sort((a, b) => {
      const ac = a.agency_code || '';
      const bc = b.agency_code || '';
      if (ac !== bc) return ac.localeCompare(bc);
      return String(a.code).localeCompare(String(b.code));
    });
    const numFmt = ['', '', '', '0.00', '', '#,##0', '#,##0', '#,##0', 'yyyy-mm-dd', ...MONTHS.map(() => '#,##0')];
    sorted.forEach((p, idx) => {
      const y = calcOriginalYield(p);
      const d = originalHarvestDateForReport(p);
      const mi = d ? new Date(d).getMonth() : -1;
      const monthVals = MONTHS.map((_, i) => (i === mi ? y : null));
      const row = sheet.addRow([
        p.agency_code || '',
        p.code,
        p.owner_name || '',
        p.area != null ? Number(p.area) : null,
        p.status || '',
        p.status === 'CC' ? y : null,
        p.status === 'CT' ? y : null,
        y || null,
        d ? new Date(d) : null,
        ...monthVals,
      ]);
      applyNumberFormats(row, numFmt);
      styleBodyRow(row, { zebra: idx % 2 === 1 });
    });
    setColumnWidths(sheet, [16, 12, 22, 12, 6, 12, 12, 12, 14, ...MONTHS.map(() => 10)]);
  }
  finalizeSheetView(sheet, 4);
}

function buildAdjusted(sheet, { granularity, ponds, agencies, filterLine }) {
  const title = 'Kế hoạch điều chỉnh';
  if (granularity === 'agency') {
    const headers = ['Đại lý', 'Số ao CC', 'Số ao CT', 'KH Gốc (kg)', 'KH Điều chỉnh (kg)', 'Chênh lệch (%)', ...MONTHS];
    addSheetCommonTop(sheet, { title, filterLine, headers });
    const numFmt = ['', '', '', '#,##0', '#,##0', '0', ...MONTHS.map(() => '#,##0')];
    agencies.forEach((agency, idx) => {
      const ap = ponds.filter((p) => p.agency_code === agency);
      const origTotal = ap.reduce((s, p) => s + calcOriginalYield(p), 0);
      const adjTotal = ap.reduce((s, p) => s + (p.expected_yield || 0), 0);
      const pct = diffPct(origTotal, adjTotal);
      const monthAdj = MONTHS.map((_, i) =>
        ap.reduce(
          (s, p) =>
            s +
            (p.expected_harvest_date && new Date(p.expected_harvest_date).getMonth() === i ? p.expected_yield || 0 : 0),
          0
        )
      );
      const row = sheet.addRow([
        agency,
        ap.filter((p) => p.status === 'CC').length,
        ap.filter((p) => p.status === 'CT').length,
        origTotal || null,
        adjTotal || null,
        pct != null ? pct : null,
        ...monthAdj,
      ]);
      applyNumberFormats(row, numFmt);
      styleBodyRow(row, { zebra: idx % 2 === 1 });
    });
    const grandOrig = ponds.reduce((s, p) => s + calcOriginalYield(p), 0);
    const grandAdj = ponds.reduce((s, p) => s + (p.expected_yield || 0), 0);
    const grandPct = diffPct(grandOrig, grandAdj);
    const grandMonths = MONTHS.map((_, i) =>
      ponds.reduce(
        (s, p) =>
          s +
          (p.expected_harvest_date && new Date(p.expected_harvest_date).getMonth() === i ? p.expected_yield || 0 : 0),
        0
      )
    );
    const totalRow = sheet.addRow([
      'TỔNG CỘNG',
      ponds.filter((p) => p.status === 'CC').length,
      ponds.filter((p) => p.status === 'CT').length,
      grandOrig,
      grandAdj,
      grandPct != null ? grandPct : null,
      ...grandMonths,
    ]);
    applyNumberFormats(totalRow, numFmt);
    styleBodyRow(totalRow, { isTotal: true });
    setColumnWidths(sheet, [20, 10, 10, 16, 18, 14, ...MONTHS.map(() => 11)]);
  } else {
    const headers = [
      'Đại lý',
      'Mã ao',
      'Chủ hộ',
      'TT',
      'KH Gốc (kg)',
      'KH Điều chỉnh (kg)',
      'Chênh lệch (%)',
      'Ngày thu ĐC',
      ...MONTHS,
    ];
    addSheetCommonTop(sheet, { title, filterLine, headers });
    const sorted = [...ponds].sort((a, b) => {
      const ac = a.agency_code || '';
      const bc = b.agency_code || '';
      if (ac !== bc) return ac.localeCompare(bc);
      return String(a.code).localeCompare(String(b.code));
    });
    const numFmt = ['', '', '', '', '#,##0', '#,##0', '0', 'yyyy-mm-dd', ...MONTHS.map(() => '#,##0')];
    sorted.forEach((p, idx) => {
      const orig = calcOriginalYield(p);
      const adj = p.expected_yield || 0;
      const pct = orig > 0 ? Math.round(((adj - orig) / orig) * 100) : null;
      const ed = p.expected_harvest_date ? new Date(p.expected_harvest_date) : null;
      const monthVals = MONTHS.map((_, i) =>
        p.expected_harvest_date && new Date(p.expected_harvest_date).getMonth() === i ? adj : null
      );
      const row = sheet.addRow([
        p.agency_code || '',
        p.code,
        p.owner_name || '',
        p.status || '',
        orig || null,
        adj || null,
        pct != null ? pct : null,
        ed,
        ...monthVals,
      ]);
      applyNumberFormats(row, numFmt);
      styleBodyRow(row, { zebra: idx % 2 === 1 });
    });
    setColumnWidths(sheet, [16, 12, 22, 6, 14, 16, 12, 14, ...MONTHS.map(() => 10)]);
  }
  finalizeSheetView(sheet, 4);
}

function buildHarvest(sheet, { granularity, ponds, harvests, harvestAlertDays, filterLine }) {
  const title = 'Kế hoạch thu & Thực thu';
  const active = ponds.filter((p) => p.status === 'CC' || p.expected_harvest_date);
  if (granularity === 'agency') {
    const headers = ['Đại lý', 'Số ao', 'Tổng KH thu (kg)', 'Đã thu (kg)', 'Còn tồn (kg)', 'FCR trung bình'];
    addSheetCommonTop(sheet, { title, filterLine, headers });
    const codes = [...new Set(active.map((p) => p.agency_code || '(Chưa phân)'))].sort((a, b) => a.localeCompare(b));
    codes.forEach((agency, idx) => {
      const ap = active.filter((p) => (p.agency_code || '(Chưa phân)') === agency);
      const planned = ap.reduce((s, p) => s + (p.expected_yield || 0), 0);
      const actual = ap.reduce((s, p) => {
        const v = pondActualYield(p, harvests);
        return s + v;
      }, 0);
      const remaining = planned > 0 ? Math.max(0, planned - actual) : null;
      const fcrs = ap.map((p) => p.fcr).filter((f) => f != null && !Number.isNaN(f));
      const avgFcr = fcrs.length ? fcrs.reduce((a, b) => a + b, 0) / fcrs.length : null;
      const row = sheet.addRow([agency, ap.length, planned || null, actual || null, remaining, avgFcr]);
      applyNumberFormats(row, ['', '', '#,##0', '#,##0', '#,##0', '0.00']);
      styleBodyRow(row, { zebra: idx % 2 === 1 });
    });
    const totalPlanned = active.reduce((s, p) => s + (p.expected_yield || 0), 0);
    const totalActual = active.reduce((s, p) => s + pondActualYield(p, harvests), 0);
    const totalRem = totalPlanned > 0 ? Math.max(0, totalPlanned - totalActual) : null;
    const totalRow = sheet.addRow(['TỔNG CỘNG', active.length, totalPlanned, totalActual, totalRem, null]);
    applyNumberFormats(totalRow, ['', '', '#,##0', '#,##0', '#,##0', '0.00']);
    styleBodyRow(totalRow, { isTotal: true });
    setColumnWidths(sheet, [22, 10, 18, 16, 16, 14]);
  } else {
    const headers = [
      'Đại lý',
      'Mã ao',
      'Chủ hộ',
      'Diện tích (m²)',
      'Trạng thái ao',
      'Nhóm thu hoạch',
      'Ngày thu DK',
      'KH thu (kg)',
      'Đã thu (kg)',
      'Còn tồn (kg)',
      'FCR',
      'Mã lô',
    ];
    addSheetCommonTop(sheet, { title, filterLine, headers });
    const sorted = [...active].sort((a, b) => {
      const ac = a.agency_code || '';
      const bc = b.agency_code || '';
      if (ac !== bc) return ac.localeCompare(bc);
      return String(a.code).localeCompare(String(b.code));
    });
    const numFmt = ['', '', '', '0.00', '', '', 'yyyy-mm-dd', '#,##0', '#,##0', '#,##0', '0.00', ''];
    sorted.forEach((p, idx) => {
      const pondHarvests = harvests.filter((h) => h.pond_code === p.code || h.pond_id === p.id);
      const totalAct = pondHarvests.reduce((s, h) => s + (h.actual_yield || 0), 0);
      const planned = p.expected_yield || 0;
      const remaining = planned > 0 ? Math.max(0, planned - totalAct) : null;
      const hStatus = classifyHarvestStatus(p, totalAct, harvestAlertDays);
      const lots = pondHarvests
        .map((h) => h.lot_code)
        .filter(Boolean)
        .join('; ');
      const row = sheet.addRow([
        p.agency_code || '',
        p.code,
        p.owner_name || '',
        p.area != null ? Number(p.area) : null,
        p.status || '',
        harvestStatusLabel(hStatus),
        p.expected_harvest_date ? new Date(p.expected_harvest_date) : null,
        planned || null,
        totalAct || null,
        remaining,
        p.fcr != null ? Number(p.fcr) : null,
        lots,
      ]);
      applyNumberFormats(row, numFmt);
      styleBodyRow(row, { zebra: idx % 2 === 1 });
    });
    setColumnWidths(sheet, [14, 12, 20, 11, 8, 18, 12, 14, 14, 14, 8, 20]);
  }
  finalizeSheetView(sheet, 4);
}

function buildSummary(sheet, { granularity, ponds, harvests, agencies, filterLine }) {
  const title = 'Tổng quan (theo bộ lọc)';
  const calcOrig = calcOriginalYield;
  if (granularity === 'agency') {
    const headers = [
      'Đại lý',
      'Tổng ao',
      'CC',
      'CT',
      'KH Gốc (kg)',
      'KH Điều chỉnh (kg)',
      'Đã thu (kg)',
      'Còn tồn (kg)',
      'FCR TB',
    ];
    addSheetCommonTop(sheet, { title, filterLine, headers });
    const numFmt = ['', '', '', '', '#,##0', '#,##0', '#,##0', '#,##0', '0.00'];
    agencies.forEach((agency, idx) => {
      const ap = ponds.filter((p) => p.agency_code === agency);
      const ah = harvests.filter((h) => h.agency_code === agency);
      const origYield = ap.reduce((s, p) => s + calcOrig(p), 0);
      const adjYield = ap.reduce((s, p) => s + (p.expected_yield || 0), 0);
      const actYield = ah.reduce((s, h) => s + (h.actual_yield || 0), 0);
      const remaining = Math.max(0, adjYield - actYield);
      const fcrArr = ap.map((p) => p.fcr).filter((f) => f != null);
      const avgFcr = fcrArr.length ? fcrArr.reduce((s, f) => s + f, 0) / fcrArr.length : null;
      const row = sheet.addRow([
        agency,
        ap.length,
        ap.filter((p) => p.status === 'CC').length,
        ap.filter((p) => p.status === 'CT').length,
        origYield || null,
        adjYield || null,
        actYield || null,
        adjYield > 0 ? remaining : null,
        avgFcr,
      ]);
      applyNumberFormats(row, numFmt);
      styleBodyRow(row, { zebra: idx % 2 === 1 });
    });
    const totalOrig = ponds.reduce((s, p) => s + calcOrig(p), 0);
    const totalAdj = ponds.reduce((s, p) => s + (p.expected_yield || 0), 0);
    const totalAct = harvests.reduce((s, h) => s + (h.actual_yield || 0), 0);
    const totalRem = Math.max(0, totalAdj - totalAct);
    const totalRow = sheet.addRow([
      'TỔNG CỘNG',
      ponds.length,
      ponds.filter((p) => p.status === 'CC').length,
      ponds.filter((p) => p.status === 'CT').length,
      totalOrig,
      totalAdj,
      totalAct,
      totalAdj > 0 ? totalRem : null,
      null,
    ]);
    applyNumberFormats(totalRow, numFmt);
    styleBodyRow(totalRow, { isTotal: true });
    setColumnWidths(sheet, [18, 10, 8, 8, 16, 16, 14, 14, 10]);
  } else {
    const headers = [
      'Đại lý',
      'Mã ao',
      'Chủ hộ',
      'Diện tích (m²)',
      'TT',
      'KH Gốc (kg)',
      'KH Điều chỉnh (kg)',
      'Đã thu (kg)',
      'Còn tồn (kg)',
      'FCR',
    ];
    addSheetCommonTop(sheet, { title, filterLine, headers });
    const sorted = [...ponds].sort((a, b) => {
      const ac = a.agency_code || '';
      const bc = b.agency_code || '';
      if (ac !== bc) return ac.localeCompare(bc);
      return String(a.code).localeCompare(String(b.code));
    });
    const numFmt = ['', '', '', '0.00', '', '#,##0', '#,##0', '#,##0', '#,##0', '0.00'];
    sorted.forEach((p, idx) => {
      const origY = calcOrig(p);
      const adjY = p.expected_yield || 0;
      const actY = pondActualYield(p, harvests);
      const rem = Math.max(0, adjY - actY);
      const row = sheet.addRow([
        p.agency_code || '',
        p.code,
        p.owner_name || '',
        p.area != null ? Number(p.area) : null,
        p.status || '',
        origY || null,
        adjY || null,
        actY || null,
        adjY > 0 ? rem : null,
        p.fcr != null ? Number(p.fcr) : null,
      ]);
      applyNumberFormats(row, numFmt);
      styleBodyRow(row, { zebra: idx % 2 === 1 });
    });
    setColumnWidths(sheet, [14, 12, 20, 11, 6, 14, 14, 14, 14, 8]);
  }
  finalizeSheetView(sheet, 4);
}

const SHEET_NAMES = {
  summary: 'Tong quan',
  original: 'KH goc',
  adjusted: 'KH dieu chinh',
  harvest: 'Thu hoach',
};

/**
 * @param {Object} opts
 * @param {'summary'|'original'|'adjusted'|'harvest'} opts.reportType
 * @param {'agency'|'pond'} opts.granularity
 * @param {Array} opts.ponds — đã lọc (batchFilteredPonds)
 * @param {Array} opts.harvests — đã lọc (filteredHarvests)
 * @param {Array} opts.agencies — mã đại lý (theo filter trang Báo cáo)
 * @param {number} opts.harvestAlertDays
 * @param {Object} opts.filters
 * @param {string} opts.filters.yearFilter
 * @param {string} opts.filters.agencyFilterLabel
 * @param {string} opts.filters.batchLabel
 */
export async function downloadReportsExcel(opts) {
  const {
    reportType,
    granularity,
    ponds,
    harvests,
    agencies,
    harvestAlertDays,
    filters: { yearFilter, agencyFilterLabel, batchLabel },
  } = opts;

  const filterLine = [
    `Năm thu (lọc): ${yearFilter}`,
    `Đại lý: ${agencyFilterLabel}`,
    `Đợt thả: ${batchLabel}`,
    `Chi tiết: ${granularity === 'agency' ? 'Tổng hợp theo đại lý' : 'Từng ao'}`,
  ].join('  ·  ');

  const workbook = new ExcelJS.Workbook();
  workbook.creator = 'My Pond App';
  workbook.created = new Date();

  const sheetName = SHEET_NAMES[reportType] || 'Bao cao';
  const sheet = workbook.addWorksheet(sheetName, { properties: { defaultRowHeight: 18 } });

  const ctx = { granularity, ponds, agencies, harvests, harvestAlertDays, filterLine };

  switch (reportType) {
    case 'summary':
      buildSummary(sheet, ctx);
      break;
    case 'original':
      buildOriginal(sheet, ctx);
      break;
    case 'adjusted':
      buildAdjusted(sheet, ctx);
      break;
    case 'harvest':
      buildHarvest(sheet, ctx);
      break;
    default:
      buildSummary(sheet, ctx);
  }

  const buf = await workbook.xlsx.writeBuffer();
  const blob = new Blob([buf], {
    type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  const slug = `${reportType}-${granularity}-${new Date().toISOString().slice(0, 10)}`;
  a.href = url;
  a.download = `bao-cao-${slug}.xlsx`;
  a.click();
  URL.revokeObjectURL(url);
}
