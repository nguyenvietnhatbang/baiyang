-- Đổi danh mục region_codes sang mã đầu biển số xe (đồng bộ src/lib/vietnamProvinces.js).
-- Chạy sau khi đã có bảng agencies/households/region_codes. An toàn chạy lại: upsert mã mới + xóa mã cũ không còn dùng.
--
-- Bước 1: đổi FK từ mã hành chính cũ → mã biển số (một mã/tỉnh; Hà Nội 30, TP.HCM 41, …).

update public.agencies
set region_code = case region_code
  when '01' then '30'
  when '02' then '23'
  when '04' then '11'
  when '06' then '97'
  when '08' then '22'
  when '10' then '24'
  when '11' then '27'
  when '12' then '25'
  when '14' then '26'
  when '15' then '21'
  when 'HB' then '28'
  when '17' then '17'
  when '19' then '20'
  when '20' then '12'
  when '22' then '14'
  when '24' then '98'
  when '25' then '19'
  when '26' then '88'
  when '30' then '34'
  when '31' then '15'
  when '33' then '89'
  when '35' then '90'
  when '36' then '18'
  when '37' then '35'
  when '38' then '36'
  when '40' then '37'
  when '42' then '38'
  when '44' then '73'
  when '45' then '74'
  when '46' then '75'
  when '48' then '43'
  when '49' then '92'
  when '51' then '76'
  when '52' then '77'
  when '54' then '78'
  when '56' then '79'
  when '58' then '85'
  when '60' then '86'
  when '62' then '82'
  when '64' then '81'
  when '66' then '47'
  when '67' then '48'
  when '68' then '49'
  when '70' then '93'
  when '72' then '70'
  when '74' then '61'
  when '75' then '39'
  when '77' then '72'
  when '79' then '41'
  when '80' then '62'
  when '82' then '63'
  when '83' then '71'
  when '84' then '84'
  when '86' then '64'
  when '87' then '66'
  when '89' then '67'
  when '91' then '68'
  when '92' then '65'
  when '93' then '95'
  when '94' then '83'
  when '95' then '94'
  when '96' then '69'
  else region_code
end
where region_code is not null;

update public.households
set region_code = case region_code
  when '01' then '30'
  when '02' then '23'
  when '04' then '11'
  when '06' then '97'
  when '08' then '22'
  when '10' then '24'
  when '11' then '27'
  when '12' then '25'
  when '14' then '26'
  when '15' then '21'
  when 'HB' then '28'
  when '17' then '17'
  when '19' then '20'
  when '20' then '12'
  when '22' then '14'
  when '24' then '98'
  when '25' then '19'
  when '26' then '88'
  when '30' then '34'
  when '31' then '15'
  when '33' then '89'
  when '35' then '90'
  when '36' then '18'
  when '37' then '35'
  when '38' then '36'
  when '40' then '37'
  when '42' then '38'
  when '44' then '73'
  when '45' then '74'
  when '46' then '75'
  when '48' then '43'
  when '49' then '92'
  when '51' then '76'
  when '52' then '77'
  when '54' then '78'
  when '56' then '79'
  when '58' then '85'
  when '60' then '86'
  when '62' then '82'
  when '64' then '81'
  when '66' then '47'
  when '67' then '48'
  when '68' then '49'
  when '70' then '93'
  when '72' then '70'
  when '74' then '61'
  when '75' then '39'
  when '77' then '72'
  when '79' then '41'
  when '80' then '62'
  when '82' then '63'
  when '83' then '71'
  when '84' then '84'
  when '86' then '64'
  when '87' then '66'
  when '89' then '67'
  when '91' then '68'
  when '92' then '65'
  when '93' then '95'
  when '94' then '83'
  when '95' then '94'
  when '96' then '69'
  else region_code
end
where region_code is not null;

-- Bước 2: upsert danh mục biển số (sort_order = số biển).

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
  ('98', 'Bắc Giang', 98),
  ('99', 'Bắc Ninh', 99)
on conflict (code) do update
  set name = excluded.name,
      sort_order = excluded.sort_order;

-- Bước 3: xóa dòng mã cũ (hành chính) không còn trong danh mục biển số.

delete from public.region_codes
where code not in (
  '11','12','14','15','17','18','19','20','21','22','23','24','25','26','27','28','30','34','35','36','37','38','39','41','43','47','48','49',
  '61','62','63','64','65','66','67','68','69','70','71','72','73','74','75','76','77','78','79','81','82','83','84','85','86','88','89','90','92','93','94','95','97','98','99'
);

update public.agencies a
set region = r.name
from public.region_codes r
where a.region_code = r.code
  and (a.region is null or a.region = '' or a.region <> r.name);
