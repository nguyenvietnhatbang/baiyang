-- Đại lý: thêm region_code (FK region_codes). Bổ sung danh mục tỉnh/TP (đồng bộ src/lib/vietnamProvinces.js).
-- Chạy trong Supabase SQL Editor (hoặc CLI). An toàn chạy lại: upsert mã tỉnh, cột agencies đã có thì bỏ qua.

alter table public.agencies
  add column if not exists region_code text references public.region_codes(code) on update cascade on delete set null;

insert into public.region_codes (code, name, sort_order) values
  ('01', 'Hà Nội', 1),
  ('02', 'Hà Giang', 2),
  ('04', 'Cao Bằng', 4),
  ('06', 'Bắc Kạn', 6),
  ('08', 'Tuyên Quang', 8),
  ('10', 'Lào Cai', 10),
  ('11', 'Điện Biên', 11),
  ('12', 'Lai Châu', 12),
  ('14', 'Sơn La', 14),
  ('15', 'Yên Bái', 15),
  ('HB', 'Hòa Bình', 16),
  ('17', 'Thái Bình', 17),
  ('19', 'Thái Nguyên', 19),
  ('20', 'Lạng Sơn', 20),
  ('22', 'Quảng Ninh', 22),
  ('24', 'Bắc Giang', 24),
  ('25', 'Phú Thọ', 25),
  ('26', 'Vĩnh Phúc', 26),
  ('30', 'Hải Dương', 30),
  ('31', 'Hải Phòng', 31),
  ('33', 'Hưng Yên', 33),
  ('35', 'Hà Nam', 35),
  ('36', 'Nam Định', 36),
  ('37', 'Ninh Bình', 37),
  ('38', 'Thanh Hóa', 38),
  ('40', 'Nghệ An', 40),
  ('42', 'Hà Tĩnh', 42),
  ('44', 'Quảng Bình', 44),
  ('45', 'Quảng Trị', 45),
  ('46', 'Thừa Thiên Huế', 46),
  ('48', 'Đà Nẵng', 48),
  ('49', 'Quảng Nam', 49),
  ('51', 'Quảng Ngãi', 51),
  ('52', 'Bình Định', 52),
  ('54', 'Phú Yên', 54),
  ('56', 'Khánh Hòa', 56),
  ('58', 'Ninh Thuận', 58),
  ('60', 'Bình Thuận', 60),
  ('62', 'Kon Tum', 62),
  ('64', 'Gia Lai', 64),
  ('66', 'Đắk Lắk', 66),
  ('67', 'Đắk Nông', 67),
  ('68', 'Lâm Đồng', 68),
  ('70', 'Bình Phước', 70),
  ('72', 'Tây Ninh', 72),
  ('74', 'Bình Dương', 74),
  ('75', 'Đồng Nai', 75),
  ('77', 'Bà Rịa – Vũng Tàu', 77),
  ('79', 'TP. Hồ Chí Minh', 79),
  ('80', 'Long An', 80),
  ('82', 'Tiền Giang', 82),
  ('83', 'Bến Tre', 83),
  ('84', 'Trà Vinh', 84),
  ('86', 'Vĩnh Long', 86),
  ('87', 'Đồng Tháp', 87),
  ('89', 'An Giang', 89),
  ('91', 'Kiên Giang', 91),
  ('92', 'Cần Thơ', 92),
  ('93', 'Hậu Giang', 93),
  ('94', 'Sóc Trăng', 94),
  ('95', 'Bạc Liêu', 95),
  ('96', 'Cà Mau', 96)
on conflict (code) do update
  set name = excluded.name,
      sort_order = excluded.sort_order;

-- Đồng bộ text region (ghi chú cũ) với tên tỉnh khi đã có region_code
update public.agencies a
set region = r.name
from public.region_codes r
where a.region_code = r.code
  and (a.region is null or a.region = '' or a.region = r.name);
