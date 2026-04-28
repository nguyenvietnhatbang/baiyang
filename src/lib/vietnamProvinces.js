/**
 * Danh mục tỉnh/TP — `code` là đầu biển số xe (theo Bộ Công an, giai đoạn áp dụng phổ biến).
 * Một tỉnh nhiều dải số → chọn một mã cố định (vd. Hà Nội 30, TP.HCM 41, Hải Phòng 15, Đồng Nai 39).
 * Lưu trong `region_codes` / `agency.region_code` / `households.region_code` và dùng cho mã ao (vd. 30-01-001-01).
 */
export const VIETNAM_PROVINCE_OPTIONS = [
  { code: '11', name: 'Cao Bằng' },
  { code: '12', name: 'Lạng Sơn' },
  { code: '14', name: 'Quảng Ninh' },
  { code: '15', name: 'Hải Phòng' },
  { code: '17', name: 'Thái Bình' },
  { code: '18', name: 'Nam Định' },
  { code: '19', name: 'Phú Thọ' },
  { code: '20', name: 'Thái Nguyên' },
  { code: '21', name: 'Yên Bái' },
  { code: '22', name: 'Tuyên Quang' },
  { code: '23', name: 'Hà Giang' },
  { code: '24', name: 'Lào Cai' },
  { code: '25', name: 'Lai Châu' },
  { code: '26', name: 'Sơn La' },
  { code: '27', name: 'Điện Biên' },
  { code: '28', name: 'Hòa Bình' },
  { code: '30', name: 'Hà Nội' },
  { code: '34', name: 'Hải Dương' },
  { code: '35', name: 'Ninh Bình' },
  { code: '36', name: 'Thanh Hóa' },
  { code: '37', name: 'Nghệ An' },
  { code: '38', name: 'Hà Tĩnh' },
  { code: '39', name: 'Đồng Nai' },
  { code: '41', name: 'TP. Hồ Chí Minh' },
  { code: '43', name: 'Đà Nẵng' },
  { code: '47', name: 'Đắk Lắk' },
  { code: '48', name: 'Đắk Nông' },
  { code: '49', name: 'Lâm Đồng' },
  { code: '61', name: 'Bình Dương' },
  { code: '62', name: 'Long An' },
  { code: '63', name: 'Tiền Giang' },
  { code: '64', name: 'Vĩnh Long' },
  { code: '65', name: 'Cần Thơ' },
  { code: '66', name: 'Đồng Tháp' },
  { code: '67', name: 'An Giang' },
  { code: '68', name: 'Kiên Giang' },
  { code: '69', name: 'Cà Mau' },
  { code: '70', name: 'Tây Ninh' },
  { code: '71', name: 'Bến Tre' },
  { code: '72', name: 'Bà Rịa - Vũng Tàu' },
  { code: '73', name: 'Quảng Bình' },
  { code: '74', name: 'Quảng Trị' },
  { code: '75', name: 'Thừa Thiên Huế' },
  { code: '76', name: 'Quảng Ngãi' },
  { code: '77', name: 'Bình Định' },
  { code: '78', name: 'Phú Yên' },
  { code: '79', name: 'Khánh Hòa' },
  { code: '81', name: 'Gia Lai' },
  { code: '82', name: 'Kon Tum' },
  { code: '83', name: 'Sóc Trăng' },
  { code: '84', name: 'Trà Vinh' },
  { code: '85', name: 'Ninh Thuận' },
  { code: '86', name: 'Bình Thuận' },
  { code: '88', name: 'Vĩnh Phúc' },
  { code: '89', name: 'Hưng Yên' },
  { code: '90', name: 'Hà Nam' },
  { code: '92', name: 'Quảng Nam' },
  { code: '93', name: 'Bình Phước' },
  { code: '94', name: 'Bạc Liêu' },
  { code: '95', name: 'Hậu Giang' },
  { code: '97', name: 'Bắc Kạn' },
  { code: '98', name: 'Bắc Giang' },
  { code: '99', name: 'Bắc Ninh' },
];

/** Sắp xếp theo số biển (11 → 99) */
export function provinceSortOrder(code) {
  if (!code) return 999;
  const n = parseInt(String(code), 10);
  return Number.isFinite(n) ? n : 999;
}

export function provinceNameByCode(code) {
  if (!code) return '';
  return VIETNAM_PROVINCE_OPTIONS.find((p) => p.code === String(code))?.name || '';
}
