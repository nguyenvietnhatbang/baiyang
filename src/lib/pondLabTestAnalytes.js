/** 15 chỉ tiêu kháng sinh / hóa chất — mẫu báo cáo TIEN PHONG LAB. */
export const LAB_ANALYTES = [
  { key: 'enrofloxacin', name: 'Enrofloxacin', lod: 0.2, method: 'LC-MS/MS' },
  { key: 'ciprofloxacin', name: 'Ciprofloxacin', lod: 0.2, method: 'LC-MS/MS' },
  { key: 'sulfadiazine', name: 'Sulfadiazine', lod: 1.0, method: 'LC-MS/MS' },
  { key: 'sulfadimidine', name: 'Sulfadimidine', lod: 1.0, method: 'LC-MS/MS' },
  { key: 'malachite_green', name: 'Malachite green', lod: 0.02, method: 'LC-MS/MS' },
  { key: 'leucomalachite_green', name: 'Leucomalachite green', lod: 0.02, method: 'LC-MS/MS' },
  { key: 'cap', name: 'CAP', lod: 0.02, method: 'LC-MS/MS' },
  { key: 'florfenicol', name: 'Florfenicol', lod: 0.1, method: 'LC-MS/MS' },
  { key: 'aoz', name: 'AOZ', lod: 0.02, method: 'LC-MS/MS' },
  { key: 'amoz', name: 'AMOZ', lod: 0.02, method: 'LC-MS/MS' },
  { key: 'ahd', name: 'AHD', lod: 0.02, method: 'LC-MS/MS' },
  { key: 'sem', name: 'SEM', lod: 0.02, method: 'LC-MS/MS' },
  { key: 'trimethoprim', name: 'Trimethoprim', lod: 0.2, method: 'LC-MS/MS' },
  { key: 'crystal_violet', name: 'Crystal violet', lod: 0.02, method: 'LC-MS/MS' },
  { key: 'leucocrystal_violet', name: 'Leucocrystal violet', lod: 0.02, method: 'LC-MS/MS' },
];

export const DEFAULT_LAB_CUSTOMER = 'CÔNG TY TNHH VIỆT NHẬT - BAIYANG';
export const DEFAULT_LAB_NAME = 'TIEN PHONG LAB';

/** Khởi tạo dòng kết quả mặc định (ND). */
export function defaultAnalyteResults() {
  return LAB_ANALYTES.map((a) => ({
    key: a.key,
    name: a.name,
    result: 'ND',
    lod: a.lod,
    method: a.method,
  }));
}

/** Chuẩn hóa giá trị nhập: ND hoặc số ppb. */
export function normalizeAnalyteResultInput(raw) {
  const s = String(raw ?? '').trim();
  if (!s || /^nd$/i.test(s)) return 'ND';
  const n = Number(s.replace(',', '.'));
  if (!Number.isFinite(n) || n < 0) return 'ND';
  return String(Math.round(n * 100) / 100);
}

export function isAnalyteDetected(result) {
  if (result == null || result === '') return false;
  if (String(result).toUpperCase() === 'ND') return false;
  const n = Number(result);
  return Number.isFinite(n) && n > 0;
}

export function formatAnalyteResultDisplay(result) {
  if (!isAnalyteDetected(result)) return 'ND';
  const n = Number(result);
  return Number.isFinite(n) ? n.toLocaleString(undefined, { maximumFractionDigits: 2 }) : String(result);
}

/** Gộp kết quả đã lưu với danh sách chỉ tiêu chuẩn. */
export function mergeAnalyteResults(saved) {
  const byKey = new Map((saved || []).map((r) => [r.key, r]));
  return LAB_ANALYTES.map((a) => {
    const prev = byKey.get(a.key);
    return {
      key: a.key,
      name: a.name,
      result: prev?.result != null ? normalizeAnalyteResultInput(prev.result) : 'ND',
      lod: prev?.lod ?? a.lod,
      method: prev?.method ?? a.method,
    };
  });
}

export function countDetectedAnalytes(analytes) {
  return (analytes || []).filter((r) => isAnalyteDetected(r.result)).length;
}
