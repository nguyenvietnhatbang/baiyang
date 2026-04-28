-- Đại lý: thêm region_code (FK region_codes). Danh mục tỉnh/TP theo đầu biển số (đồng bộ src/lib/vietnamProvinces.js).
-- Chạy trong Supabase SQL Editor (hoặc CLI). An toàn chạy lại: upsert mã tỉnh, cột agencies đã có thì bỏ qua.

alter table public.agencies
  add column if not exists region_code text references public.region_codes(code) on update cascade on delete set null;

-- Mã `code` = đầu biển số (đồng bộ src/lib/vietnamProvinces.js). DB cũ dùng mã hành chính: chạy thêm 20260502_region_codes_license_plate.sql.
insert into public.region_codes (code, name, sort_order) values
  ('11', 'Cao Bằng', 11),
  ('12', 'Lạng Sơn', 12),
  ('14', 'Quảng Ninh', 14),
  ('15', 'Hải Phòng', 15),
  ('17', 'Thái Bình', 17),
  ('18', 'Nam Định', 18),
  ('19', 'Phú Thọ', 19),
  ('20', 'Thái Nguyên', 20),
  ('21', 'Yên Bái', 21),
  ('22', 'Tuyên Quang', 22),
  ('23', 'Hà Giang', 23),
  ('24', 'Lào Cai', 24),
  ('25', 'Lai Châu', 25),
  ('26', 'Sơn La', 26),
  ('27', 'Điện Biên', 27),
  ('28', 'Hòa Bình', 28),
  ('30', 'Hà Nội', 30),
  ('34', 'Hải Dương', 34),
  ('35', 'Ninh Bình', 35),
  ('36', 'Thanh Hóa', 36),
  ('37', 'Nghệ An', 37),
  ('38', 'Hà Tĩnh', 38),
  ('39', 'Đồng Nai', 39),
  ('41', 'TP. Hồ Chí Minh', 41),
  ('43', 'Đà Nẵng', 43),
  ('47', 'Đắk Lắk', 47),
  ('48', 'Đắk Nông', 48),
  ('49', 'Lâm Đồng', 49),
  ('61', 'Bình Dương', 61),
  ('62', 'Long An', 62),
  ('63', 'Tiền Giang', 63),
  ('64', 'Vĩnh Long', 64),
  ('65', 'Cần Thơ', 65),
  ('66', 'Đồng Tháp', 66),
  ('67', 'An Giang', 67),
  ('68', 'Kiên Giang', 68),
  ('69', 'Cà Mau', 69),
  ('70', 'Tây Ninh', 70),
  ('71', 'Bến Tre', 71),
  ('72', 'Bà Rịa - Vũng Tàu', 72),
  ('73', 'Quảng Bình', 73),
  ('74', 'Quảng Trị', 74),
  ('75', 'Thừa Thiên Huế', 75),
  ('76', 'Quảng Ngãi', 76),
  ('77', 'Bình Định', 77),
  ('78', 'Phú Yên', 78),
  ('79', 'Khánh Hòa', 79),
  ('81', 'Gia Lai', 81),
  ('82', 'Kon Tum', 82),
  ('83', 'Sóc Trăng', 83),
  ('84', 'Trà Vinh', 84),
  ('85', 'Ninh Thuận', 85),
  ('86', 'Bình Thuận', 86),
  ('88', 'Vĩnh Phúc', 88),
  ('89', 'Hưng Yên', 89),
  ('90', 'Hà Nam', 90),
  ('92', 'Quảng Nam', 92),
  ('93', 'Bình Phước', 93),
  ('94', 'Bạc Liêu', 94),
  ('95', 'Hậu Giang', 95),
  ('97', 'Bắc Kạn', 97),
  ('98', 'Bắc Giang', 98),
  ('99', 'Bắc Ninh', 99)
on conflict (code) do update
  set name = excluded.name,
      sort_order = excluded.sort_order;

-- Đồng bộ text region (ghi chú cũ) với tên tỉnh khi đã có region_code
update public.agencies a
set region = r.name
from public.region_codes r
where a.region_code = r.code
  and (a.region is null or a.region = '' or a.region = r.name);
