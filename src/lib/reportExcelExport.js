/**
 * Xuất báo cáo ra Excel (.xlsx) với định dạng cơ bản (tiêu đề, header màu, viền, số có phân tách nghìn).
 * Dùng ExcelJS — khi mở bằng Excel/LibreOffice vẫn có thể chỉnh theme/font theo ứng dụng.
 */

import ExcelJS from 'exceljs';
import { originalHarvestDateForReport, plannedHarvestDateForDisplay } from '@/lib/planReportHelpers';
import { classifyHarvestStatus, harvestStatusLabel } from '@/lib/harvestAlerts';
import { getFactoryPlanKgByMonth } from '@/lib/appSettingsHelpers';
import {
  harvestRecordsForCycleRow,
  latestActualHarvestDate,
  totalActualYieldForCycleRow,
  uniquePhysicalPondCount,
  uniquePhysicalPondTotalArea,
} from '@/lib/reportPondDedupe';

const MONTHS = Array.from({ length: 12 }, (_, i) => `T${i + 1}`);
const MONTH_LABELS_LONG = Array.from({ length: 12 }, (_, i) => `Tháng ${i + 1}`);

function systemCodeFromAgencyCode(agencyCode) {
  const digits = String(agencyCode || '').replace(/\D/g, '');
  return digits || String(agencyCode || '').trim();
}

function styleHeaderRowSoft(row) {
  row.height = 22;
  row.eachCell({ includeEmpty: true }, (cell, colNumber) => {
    cell.font = { bold: true, size: 10, color: { argb: 'FF1F2937' } };
    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF3F4F6' } };
    cell.alignment = {
      vertical: 'middle',
      horizontal: colNumber <= 2 ? 'left' : 'center',
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

function styleSubHeaderRow(row) {
  row.height = 18;
  row.eachCell({ includeEmpty: true }, (cell) => {
    cell.font = { bold: true, size: 9, color: { argb: 'FF111827' } };
    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFFFFFF' } };
    cell.alignment = { vertical: 'middle', horizontal: 'center', wrapText: true };
    cell.border = {
      top: { style: 'thin', color: { argb: 'FF000000' } },
      left: { style: 'thin', color: { argb: 'FF000000' } },
      bottom: { style: 'thin', color: { argb: 'FF000000' } },
      right: { style: 'thin', color: { argb: 'FF000000' } },
    };
  });
}

function addPlanMatrixTop(sheet, { title, filterLine }) {
  const fixedCols = 4; // Mã hệ thống, Hệ thống, Số lượng ao nuôi, Diện tích
  const monthGroups = 12;
  const colsPerMonth = 3;
  const totalCols = 3; // CC, CT, TH
  const ncol = fixedCols + monthGroups * colsPerMonth + totalCols;

  sheet.addRow([title]);
  styleTitleRow(sheet.getRow(1), ncol);
  sheet.addRow([filterLine]);
  styleFilterRow(sheet.getRow(2), ncol);
  sheet.addRow([]);

  // Header row 1 (merged months)
  const header1 = [
    'Mã hệ thống',
    'Hệ thống',
    'Số lượng ao nuôi',
    'Diện tích',
    ...MONTH_LABELS_LONG.flatMap((m) => [m, '', '']),
    'Tổng',
    '',
    '',
  ];
  sheet.addRow(header1);
  styleHeaderRowSoft(sheet.getRow(4));

  // Merge fixed headers vertically across 2 header rows
  sheet.mergeCells(4, 1, 5, 1);
  sheet.mergeCells(4, 2, 5, 2);
  sheet.mergeCells(4, 3, 5, 3);
  sheet.mergeCells(4, 4, 5, 4);

  // Merge each month group across 3 columns (row 4)
  for (let i = 0; i < 12; i += 1) {
    const start = fixedCols + i * colsPerMonth + 1;
    sheet.mergeCells(4, start, 4, start + 2);
  }

  // Merge "Tổng" across 3 columns
  const totalStart = fixedCols + monthGroups * colsPerMonth + 1;
  sheet.mergeCells(4, totalStart, 4, totalStart + 2);

  // Header row 2 (CC/CT/TH)
  const header2 = [
    '',
    '',
    '',
    '',
    ...Array.from({ length: 12 }, () => ['CC', 'CT', 'TH']).flat(),
    'CC',
    'CT',
    'TH',
  ];
  sheet.addRow(header2);
  styleSubHeaderRow(sheet.getRow(5));

  return { headerRowIndex: 5, ncol };
}

function activeMonthIdxFromRows(rows, dateAccessor, valueAccessor) {
  const set = new Set();
  (rows || []).forEach((r) => {
    const d = dateAccessor(r);
    const v = valueAccessor(r);
    if (!d || !v || Number(v) <= 0) return;
    set.add(new Date(d).getMonth());
  });
  return [...set].sort((a, b) => a - b);
}

function calcOriginalYield(p) {
  if (!p?.total_fish || !p?.survival_rate || !p?.target_weight) return 0;
  return Math.round((p.total_fish * (p.survival_rate / 100) * p.target_weight) / 1000);
}

function pondActualYield(p, harvests) {
  return totalActualYieldForCycleRow(p, harvests);
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

function buildOriginal(sheet, { granularity, ponds, agencies, filterLine, factoryPlanKgByMonth }) {
  const title = 'Kế hoạch ban đầu (gốc)';
  const monthIdx = Array.from({ length: 12 }, (_, i) => i);
  const factoryPlan = Array.isArray(factoryPlanKgByMonth) ? factoryPlanKgByMonth : Array.from({ length: 12 }, () => 0);
  if (granularity === 'agency') {
    const { headerRowIndex } = addPlanMatrixTop(sheet, { title: 'KẾ HOẠCH GỐC', filterLine });
    const numFmt = [
      '',
      '',
      '0',
      '0.00',
      ...Array.from({ length: 12 }, () => ['#,##0', '#,##0', '#,##0']).flat(),
      '#,##0',
      '#,##0',
      '#,##0',
    ];
    agencies.forEach((agency, idx) => {
      const ap = ponds.filter((p) => p.agency_code === agency);
      const cc = ap.filter((p) => p.status === 'CC');
      const ct = ap.filter((p) => p.status === 'CT');
      const totalArea = uniquePhysicalPondTotalArea(ap);
      const monthCC = monthIdx.map((i) =>
        cc.reduce((s, p) => {
          const d = originalHarvestDateForReport(p);
          return s + (d && new Date(d).getMonth() === i ? calcOriginalYield(p) : 0);
        }, 0)
      );
      const monthCT = monthIdx.map((i) =>
        ct.reduce((s, p) => {
          const d = originalHarvestDateForReport(p);
          return s + (d && new Date(d).getMonth() === i ? calcOriginalYield(p) : 0);
        }, 0)
      );
      const monthTH = monthCC.map((v, i) => v + monthCT[i]);
      const totalCC = monthCC.reduce((s, v) => s + v, 0);
      const totalCT = monthCT.reduce((s, v) => s + v, 0);
      const totalTH = totalCC + totalCT;
      const monthTriplets = monthIdx.flatMap((_, i) => [monthCC[i] || null, monthCT[i] || null, monthTH[i] || null]);

      const row = sheet.addRow([
        systemCodeFromAgencyCode(agency),
        agency,
        uniquePhysicalPondCount(ap) || null,
        totalArea || null,
        ...monthTriplets,
        totalCC || null,
        totalCT || null,
        totalTH || null,
      ]);
      applyNumberFormats(row, numFmt);
      styleBodyRow(row, { zebra: idx % 2 === 1 });
    });
    const grandArea = uniquePhysicalPondTotalArea(ponds);
    const grandMonthCC = monthIdx.map((i) =>
      ponds.reduce((s, p) => {
        if (p.status !== 'CC') return s;
        const d = originalHarvestDateForReport(p);
        return s + (d && new Date(d).getMonth() === i ? calcOriginalYield(p) : 0);
      }, 0)
    );
    const grandMonthCT = monthIdx.map((i) =>
      ponds.reduce((s, p) => {
        if (p.status !== 'CT') return s;
        const d = originalHarvestDateForReport(p);
        return s + (d && new Date(d).getMonth() === i ? calcOriginalYield(p) : 0);
      }, 0)
    );
    const grandMonthTH = grandMonthCC.map((v, i) => v + grandMonthCT[i]);
    const grandTotalCC = grandMonthCC.reduce((s, v) => s + v, 0);
    const grandTotalCT = grandMonthCT.reduce((s, v) => s + v, 0);
    const grandTotalTH = grandTotalCC + grandTotalCT;
    const grandTriplets = monthIdx.flatMap((_, i) => [grandMonthCC[i] || null, grandMonthCT[i] || null, grandMonthTH[i] || null]);

    const totalRow = sheet.addRow(['', 'Tổng', uniquePhysicalPondCount(ponds) || null, grandArea || null, ...grandTriplets, grandTotalCC || null, grandTotalCT || null, grandTotalTH || null]);
    applyNumberFormats(totalRow, numFmt);
    styleBodyRow(totalRow, { isTotal: true });

    const fMonths = monthIdx.map((i) => Number(factoryPlan[i] || 0) || 0);
    const fTotal = fMonths.reduce((s, v) => s + v, 0);
    const deltaMonths = grandMonthTH.map((v, i) => (Number(v || 0) || 0) - (Number(fMonths[i] || 0) || 0));
    const deltaTotal = (Number(grandTotalTH || 0) || 0) - (Number(fTotal || 0) || 0);
    const fTriplets = monthIdx.flatMap((_, i) => [null, null, fMonths[i] > 0 ? fMonths[i] : null]);
    const dTriplets = monthIdx.flatMap((_, i) => [null, null, deltaMonths[i] !== 0 ? deltaMonths[i] : null]);

    const factoryRow = sheet.addRow(['', 'Sản lượng Nhà máy giao', null, null, ...fTriplets, null, null, fTotal || null]);
    applyNumberFormats(factoryRow, numFmt);
    styleBodyRow(factoryRow, { zebra: false });
    factoryRow.font = { bold: true, color: { argb: 'FF7C2D12' } };

    const deltaRow = sheet.addRow(['', 'Cân đối', null, null, ...dTriplets, null, null, deltaTotal || null]);
    applyNumberFormats(deltaRow, numFmt);
    styleBodyRow(deltaRow, { zebra: false });
    deltaRow.font = { bold: true };

    setColumnWidths(sheet, [12, 18, 14, 10, ...Array.from({ length: 12 }, () => [7, 7, 7]).flat(), 7, 7, 7]);
    finalizeSheetView(sheet, headerRowIndex);
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
      ...monthLabels,
    ];
    addSheetCommonTop(sheet, { title, filterLine, headers });
    const sorted = [...ponds].sort((a, b) => {
      const ac = a.agency_code || '';
      const bc = b.agency_code || '';
      if (ac !== bc) return ac.localeCompare(bc);
      return String(a.code).localeCompare(String(b.code));
    });
    const numFmt = ['', '', '', '0.00', '', '#,##0', '#,##0', '#,##0', 'yyyy-mm-dd', ...monthLabels.map(() => '#,##0')];
    sorted.forEach((p, idx) => {
      const y = calcOriginalYield(p);
      const d = originalHarvestDateForReport(p);
      const mi = d ? new Date(d).getMonth() : -1;
      const monthVals = monthIdx.map((i) => (i === mi ? y : null));
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
    setColumnWidths(sheet, [16, 12, 22, 12, 6, 12, 12, 12, 14, ...monthLabels.map(() => 10)]);
  }
  if (granularity !== 'agency') finalizeSheetView(sheet, 4);
}

function buildAdjusted(sheet, { granularity, ponds, agencies, filterLine, factoryPlanKgByMonth }) {
  const title = 'Kế hoạch điều chỉnh';
  const adjustedHarvestDate = (p) => plannedHarvestDateForDisplay(p);
  const monthIdx = Array.from({ length: 12 }, (_, i) => i);
  const factoryPlan = Array.isArray(factoryPlanKgByMonth) ? factoryPlanKgByMonth : Array.from({ length: 12 }, () => 0);
  if (granularity === 'agency') {
    const { headerRowIndex } = addPlanMatrixTop(sheet, { title: 'KẾ HOẠCH ĐIỀU CHỈNH', filterLine });
    const numFmt = [
      '',
      '',
      '0',
      '0.00',
      ...Array.from({ length: 12 }, () => ['#,##0', '#,##0', '#,##0']).flat(),
      '#,##0',
      '#,##0',
      '#,##0',
    ];
    agencies.forEach((agency, idx) => {
      const ap = ponds.filter((p) => p.agency_code === agency);
      const cc = ap.filter((p) => p.status === 'CC');
      const ct = ap.filter((p) => p.status === 'CT');
      const totalArea = uniquePhysicalPondTotalArea(ap);
      const monthCC = monthIdx.map((i) =>
        cc.reduce((s, p) => s + (adjustedHarvestDate(p) && new Date(adjustedHarvestDate(p)).getMonth() === i ? p.expected_yield || 0 : 0), 0)
      );
      const monthCT = monthIdx.map((i) =>
        ct.reduce((s, p) => s + (adjustedHarvestDate(p) && new Date(adjustedHarvestDate(p)).getMonth() === i ? p.expected_yield || 0 : 0), 0)
      );
      const monthTH = monthCC.map((v, i) => v + monthCT[i]);
      const totalCC = monthCC.reduce((s, v) => s + v, 0);
      const totalCT = monthCT.reduce((s, v) => s + v, 0);
      const totalTH = totalCC + totalCT;
      const monthTriplets = monthIdx.flatMap((_, i) => [monthCC[i] || null, monthCT[i] || null, monthTH[i] || null]);
      const row = sheet.addRow([
        systemCodeFromAgencyCode(agency),
        agency,
        uniquePhysicalPondCount(ap) || null,
        totalArea || null,
        ...monthTriplets,
        totalCC || null,
        totalCT || null,
        totalTH || null,
      ]);
      applyNumberFormats(row, numFmt);
      styleBodyRow(row, { zebra: idx % 2 === 1 });
    });
    const grandArea = uniquePhysicalPondTotalArea(ponds);
    const grandMonthCC = monthIdx.map((i) =>
      ponds.reduce((s, p) => s + (p.status === 'CC' && adjustedHarvestDate(p) && new Date(adjustedHarvestDate(p)).getMonth() === i ? p.expected_yield || 0 : 0), 0)
    );
    const grandMonthCT = monthIdx.map((i) =>
      ponds.reduce((s, p) => s + (p.status === 'CT' && adjustedHarvestDate(p) && new Date(adjustedHarvestDate(p)).getMonth() === i ? p.expected_yield || 0 : 0), 0)
    );
    const grandMonthTH = grandMonthCC.map((v, i) => v + grandMonthCT[i]);
    const grandTotalCC = grandMonthCC.reduce((s, v) => s + v, 0);
    const grandTotalCT = grandMonthCT.reduce((s, v) => s + v, 0);
    const grandTotalTH = grandTotalCC + grandTotalCT;
    const grandTriplets = monthIdx.flatMap((_, i) => [grandMonthCC[i] || null, grandMonthCT[i] || null, grandMonthTH[i] || null]);
    const totalRow = sheet.addRow([
      '',
      'Tổng',
      uniquePhysicalPondCount(ponds) || null,
      grandArea || null,
      ...grandTriplets,
      grandTotalCC || null,
      grandTotalCT || null,
      grandTotalTH || null,
    ]);
    applyNumberFormats(totalRow, numFmt);
    styleBodyRow(totalRow, { isTotal: true });

    const fMonths = monthIdx.map((i) => Number(factoryPlan[i] || 0) || 0);
    const fTotal = fMonths.reduce((s, v) => s + v, 0);
    const deltaMonths = grandMonthTH.map((v, i) => (Number(v || 0) || 0) - (Number(fMonths[i] || 0) || 0));
    const deltaTotal = (Number(grandTotalTH || 0) || 0) - (Number(fTotal || 0) || 0);
    const fTriplets = monthIdx.flatMap((_, i) => [null, null, fMonths[i] > 0 ? fMonths[i] : null]);
    const dTriplets = monthIdx.flatMap((_, i) => [null, null, deltaMonths[i] !== 0 ? deltaMonths[i] : null]);

    const factoryRow = sheet.addRow(['', 'Sản lượng Nhà máy giao', null, null, ...fTriplets, null, null, fTotal || null]);
    applyNumberFormats(factoryRow, numFmt);
    styleBodyRow(factoryRow, { zebra: false });
    factoryRow.font = { bold: true, color: { argb: 'FF7C2D12' } };

    const deltaRow = sheet.addRow(['', 'Cân đối', null, null, ...dTriplets, null, null, deltaTotal || null]);
    applyNumberFormats(deltaRow, numFmt);
    styleBodyRow(deltaRow, { zebra: false });
    deltaRow.font = { bold: true };

    setColumnWidths(sheet, [12, 18, 14, 10, ...Array.from({ length: 12 }, () => [7, 7, 7]).flat(), 7, 7, 7]);
    finalizeSheetView(sheet, headerRowIndex);
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
      ...monthLabels,
    ];
    addSheetCommonTop(sheet, { title, filterLine, headers });
    const sorted = [...ponds].sort((a, b) => {
      const ac = a.agency_code || '';
      const bc = b.agency_code || '';
      if (ac !== bc) return ac.localeCompare(bc);
      return String(a.code).localeCompare(String(b.code));
    });
    const numFmt = ['', '', '', '', '#,##0', '#,##0', '0', 'yyyy-mm-dd', ...monthLabels.map(() => '#,##0')];
    sorted.forEach((p, idx) => {
      const orig = calcOriginalYield(p);
      const adj = p.expected_yield || 0;
      const pct = orig > 0 ? Math.round(((adj - orig) / orig) * 100) : null;
      const edRaw = adjustedHarvestDate(p);
      const ed = edRaw ? new Date(edRaw) : null;
      const monthVals = monthIdx.map((i) =>
        edRaw && new Date(edRaw).getMonth() === i ? adj : null
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
    setColumnWidths(sheet, [16, 12, 22, 6, 14, 16, 12, 14, ...monthLabels.map(() => 10)]);
  }
  if (granularity !== 'agency') finalizeSheetView(sheet, 4);
}

function buildHarvest(sheet, { granularity, ponds, harvests, harvestAlertDays, filterLine, agencyNameByCode }) {
  const title = 'Kế hoạch thu & Thực thu';
  const active = ponds.filter((p) => p.status === 'CC' || plannedHarvestDateForDisplay(p));
  if (granularity === 'agency') {
    const headers = [
      'Mã hệ thống',
      'Hệ thống',
      'Hộ nuôi',
      'Ao nuôi',
      'Chu kỳ',
      'Diện tích',
      'Kế hoạch thu (ngày thu kế)',
      'Ngày thu thực tế',
      'Sản lượng Kế hoạch',
      'Sản lượng thực tế',
      'Tổng lượng thức ăn',
      'FCR',
      'Ghi chú',
    ];
    addSheetCommonTop(sheet, { title: 'BÁO CÁO THU HOẠCH', filterLine, headers });
    const numFmt = ['', '', '', '', '', '0.00', 'yyyy-mm-dd', 'yyyy-mm-dd', '#,##0', '#,##0', '#,##0', '0.00', ''];

    const codes = [...new Set(active.map((p) => p.agency_code || '(Chưa phân)'))].sort((a, b) => a.localeCompare(b));
    codes.forEach((agency, idx) => {
      const ap = active.filter((p) => (p.agency_code || '(Chưa phân)') === agency);
      const plannedKg = ap.reduce((s, p) => s + (p.expected_yield || 0), 0);
      const actualKg = ap.reduce((s, p) => s + totalActualYieldForCycleRow(p, harvests), 0);
      const feedKg = ap.reduce((s, p) => s + (Number(p.total_feed_used) || 0), 0);
      const fcr = actualKg > 0 && feedKg > 0 ? feedKg / actualKg : null;
      const sysCode = systemCodeFromAgencyCode(agency);
      const sysName = agencyNameByCode instanceof Map ? (agencyNameByCode.get(String(agency)) || agency) : agency;

      const row = sheet.addRow([
        sysCode || null,
        sysName || agency,
        null,
        null,
        null,
        uniquePhysicalPondTotalArea(ap) || null,
        null,
        null,
        plannedKg || null,
        actualKg || null,
        feedKg || null,
        fcr,
        null,
      ]);
      applyNumberFormats(row, numFmt);
      styleBodyRow(row, { zebra: idx % 2 === 1 });
    });

    const totalPlanned = active.reduce((s, p) => s + (p.expected_yield || 0), 0);
    const totalActual = active.reduce((s, p) => s + totalActualYieldForCycleRow(p, harvests), 0);
    const totalFeed = active.reduce((s, p) => s + (Number(p.total_feed_used) || 0), 0);
    const totalFcr = totalActual > 0 && totalFeed > 0 ? totalFeed / totalActual : null;
    const totalRow = sheet.addRow([
      null,
      'Tổng',
      null,
      null,
      null,
      uniquePhysicalPondTotalArea(active) || null,
      null,
      null,
      totalPlanned || null,
      totalActual || null,
      totalFeed || null,
      totalFcr,
      null,
    ]);
    applyNumberFormats(totalRow, numFmt);
    styleBodyRow(totalRow, { isTotal: true });
    setColumnWidths(sheet, [12, 16, 16, 12, 10, 10, 18, 14, 14, 14, 16, 8, 18]);
  } else {
    const headers = [
      'Đại lý',
      'Mã ao',
      'Chủ hộ',
      'Diện tích (m²)',
      'Trạng thái ao',
      'Nhóm thu hoạch',
      'Ngày thu DK',
      'Ngày thu TT',
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
    const numFmt = ['', '', '', '0.00', '', '', 'yyyy-mm-dd', 'yyyy-mm-dd', '#,##0', '#,##0', '#,##0', '0.00', ''];
    sorted.forEach((p, idx) => {
      const pondHarvests = harvestRecordsForCycleRow(p, harvests);
      const totalAct = pondHarvests.reduce((s, h) => s + (h.actual_yield || 0), 0);
      const planned = p.expected_yield || 0;
      const remaining = planned > 0 ? Math.max(0, planned - totalAct) : null;
      const hStatus = classifyHarvestStatus(p, totalAct, harvestAlertDays);
      const ttRaw = latestActualHarvestDate(pondHarvests);
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
        plannedHarvestDateForDisplay(p) ? new Date(plannedHarvestDateForDisplay(p)) : null,
        ttRaw ? new Date(ttRaw) : null,
        planned || null,
        totalAct || null,
        remaining,
        p.fcr != null ? Number(p.fcr) : null,
        lots,
      ]);
      applyNumberFormats(row, numFmt);
      styleBodyRow(row, { zebra: idx % 2 === 1 });
    });
    setColumnWidths(sheet, [14, 12, 20, 11, 8, 18, 12, 12, 14, 14, 14, 8, 20]);
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
        uniquePhysicalPondCount(ap),
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
      uniquePhysicalPondCount(ponds),
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

function buildSummaryMatrix(sheet, { granularity, ponds, harvests, agencies, filterLine, factoryPlanKgByMonth, agencyNameByCode }) {
  if (granularity !== 'agency') {
    // Template ảnh chỉ dành cho tổng hợp theo hệ thống.
    const headers = ['Chỉ hỗ trợ xuất theo hệ thống (agency).'];
    addSheetCommonTop(sheet, { title: 'BÁO CÁO TỔNG HỢP', filterLine, headers });
    finalizeSheetView(sheet, 4);
    return;
  }

  const monthIdx = Array.from({ length: 12 }, (_, i) => i);
  const factoryPlan = Array.isArray(factoryPlanKgByMonth) ? factoryPlanKgByMonth : Array.from({ length: 12 }, () => 0);
  const headers = [
    'Mã hệ thống',
    'Hệ thống',
    ...MONTH_LABELS_LONG.flatMap((m) => [m, '']),
    'Tổng',
    '',
  ];
  const { headerRowIndex, ncol } = (() => {
    const fixedCols = 2;
    const ncolLocal = fixedCols + 12 * 2 + 2;
    sheet.addRow(['BÁO CÁO TỔNG HỢP']);
    styleTitleRow(sheet.getRow(1), ncolLocal);
    sheet.addRow([filterLine]);
    styleFilterRow(sheet.getRow(2), ncolLocal);
    sheet.addRow([]);
    sheet.addRow(headers);
    styleHeaderRowSoft(sheet.getRow(4));
    // Merge fixed headers across 2 header rows
    sheet.mergeCells(4, 1, 5, 1);
    sheet.mergeCells(4, 2, 5, 2);
    // Merge each month group (2 cols)
    for (let i = 0; i < 12; i += 1) {
      const start = fixedCols + i * 2 + 1;
      sheet.mergeCells(4, start, 4, start + 1);
    }
    const totalStart = fixedCols + 12 * 2 + 1;
    sheet.mergeCells(4, totalStart, 4, totalStart + 1);
    // Sub headers
    sheet.addRow(['', '', ...Array.from({ length: 12 }, () => ['Kế hoạch', 'Thực hiện']).flat(), 'Kế hoạch', 'Thực hiện']);
    styleSubHeaderRow(sheet.getRow(5));
    return { headerRowIndex: 5, ncol: ncolLocal };
  })();

  const harvestByCycleId = new Map();
  (harvests || []).forEach((h) => {
    if (!h?.pond_cycle_id) return;
    if (!harvestByCycleId.has(h.pond_cycle_id)) harvestByCycleId.set(h.pond_cycle_id, []);
    harvestByCycleId.get(h.pond_cycle_id).push(h);
  });

  const numFmt = [
    '',
    '',
    ...Array.from({ length: 12 }, () => ['#,##0', '#,##0']).flat(),
    '#,##0',
    '#,##0',
  ];

  const agencyRows = (agencies || []).map((agency) => {
    const ap = (ponds || []).filter((p) => p.agency_code === agency);
    const planM = Array.from({ length: 12 }, () => 0);
    const actM = Array.from({ length: 12 }, () => 0);
    ap.forEach((p) => {
      const d = plannedHarvestDateForDisplay(p);
      if (d) planM[new Date(d).getMonth()] += Number(p.expected_yield) || 0;
      const hs = harvestByCycleId.get(p.pond_cycle_id) || [];
      hs.forEach((h) => {
        if (!h.harvest_date) return;
        actM[new Date(h.harvest_date).getMonth()] += Number(h.actual_yield) || 0;
      });
    });
    const totalPlan = planM.reduce((s, v) => s + v, 0);
    const totalAct = actM.reduce((s, v) => s + v, 0);
    const sysName = agencyNameByCode instanceof Map ? (agencyNameByCode.get(String(agency)) || agency) : agency;
    return { agency, sysName, planM, actM, totalPlan, totalAct };
  });

  agencyRows.forEach((r, idx) => {
    const cells = monthIdx.flatMap((i) => [r.planM[i] || null, r.actM[i] || null]);
    const row = sheet.addRow([systemCodeFromAgencyCode(r.agency), r.sysName, ...cells, r.totalPlan || null, r.totalAct || null]);
    applyNumberFormats(row, numFmt);
    styleBodyRow(row, { zebra: idx % 2 === 1 });
  });

  const grandPlanM = monthIdx.map((i) => agencyRows.reduce((s, r) => s + (r.planM[i] || 0), 0));
  const grandActM = monthIdx.map((i) => agencyRows.reduce((s, r) => s + (r.actM[i] || 0), 0));
  const grandPlan = grandPlanM.reduce((s, v) => s + v, 0);
  const grandAct = grandActM.reduce((s, v) => s + v, 0);
  const totalRow = sheet.addRow(['', 'Tổng', ...monthIdx.flatMap((i) => [grandPlanM[i] || null, grandActM[i] || null]), grandPlan || null, grandAct || null]);
  applyNumberFormats(totalRow, numFmt);
  styleBodyRow(totalRow, { isTotal: true });
  sheet.mergeCells(totalRow.number, 1, totalRow.number, 2);

  const factoryM = monthIdx.map((i) => Number(factoryPlan[i] || 0) || 0);
  const factoryTotal = factoryM.reduce((s, v) => s + v, 0);
  const factoryRow = sheet.addRow(['', 'Sản lượng Nhà máy giao', ...monthIdx.flatMap((i) => [factoryM[i] > 0 ? factoryM[i] : null, null]), factoryTotal || null, null]);
  applyNumberFormats(factoryRow, numFmt);
  styleBodyRow(factoryRow, { zebra: false });
  factoryRow.font = { bold: true, color: { argb: 'FF7C2D12' } };
  sheet.mergeCells(factoryRow.number, 1, factoryRow.number, 2);

  const balPlanM = monthIdx.map((i) => (grandPlanM[i] || 0) - (factoryM[i] || 0));
  const balActM = monthIdx.map((i) => (grandActM[i] || 0) - (factoryM[i] || 0));
  const balRow = sheet.addRow(['', 'Cân đối', ...monthIdx.flatMap((i) => [balPlanM[i] !== 0 ? balPlanM[i] : null, balActM[i] !== 0 ? balActM[i] : null]), (grandPlan - factoryTotal) || null, (grandAct - factoryTotal) || null]);
  applyNumberFormats(balRow, numFmt);
  styleBodyRow(balRow, { zebra: false });
  balRow.font = { bold: true };
  sheet.mergeCells(balRow.number, 1, balRow.number, 2);

  setColumnWidths(sheet, [12, 16, ...Array.from({ length: 12 }, () => [10, 10]).flat(), 10, 10]);
  finalizeSheetView(sheet, headerRowIndex);
  // Ensure title merges right after widths (ncol used by styleTitleRow already)
  void ncol;
}

const SHEET_NAMES = {
  summary: 'Tong quan',
  summary_matrix: 'Bao cao tong hop',
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
    appSettings,
    agencyNameByCode,
    filters: { yearFilter, agencyFilterLabel, batchLabel },
  } = opts;

  const filterLine = [
    `Năm thu (lọc): ${yearFilter}`,
    `Đại lý: ${agencyFilterLabel}`,
    `Chu kỳ: ${batchLabel}`,
    `Chi tiết: ${granularity === 'agency' ? 'Tổng hợp theo đại lý' : 'Từng ao'}`,
  ].join('  ·  ');

  const workbook = new ExcelJS.Workbook();
  workbook.creator = 'My Pond App';
  workbook.created = new Date();

  const sheetName = SHEET_NAMES[reportType] || 'Bao cao';
  const sheet = workbook.addWorksheet(sheetName, { properties: { defaultRowHeight: 18 } });

  const ctx = {
    granularity,
    ponds,
    agencies,
    harvests,
    harvestAlertDays,
    filterLine,
    factoryPlanKgByMonth: getFactoryPlanKgByMonth(appSettings),
    agencyNameByCode,
  };

  switch (reportType) {
    case 'summary':
      buildSummary(sheet, ctx);
      break;
    case 'summary_matrix':
      buildSummaryMatrix(sheet, ctx);
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
