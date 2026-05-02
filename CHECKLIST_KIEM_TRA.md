# ✅ CHECKLIST KIỂM TRA HỆ THỐNG

**Ngày kiểm tra:** _______________  
**Người kiểm tra:** _______________

---

## 🔧 TRƯỚC KHI KIỂM TRA

- [ ] Đã chạy script đồng bộ dữ liệu (xem `docs/DONG_BO_DU_LIEU.md`)
- [ ] Đã tải lại trang (F5) sau khi đồng bộ
- [ ] Đã đăng nhập bằng tài khoản có quyền xem đầy đủ

---

## 1️⃣ KIỂM TRA BÁO CÁO KẾ HOẠCH BAN ĐẦU

**Đường dẫn:** Báo cáo → Chọn "📋 Kế hoạch ban đầu (gốc)"

### Số ao/chu kỳ
- [ ] Số chu kỳ hiển thị = Tổng số chu kỳ thực tế (không đếm trùng)
- [ ] Mỗi chu kỳ được đếm riêng biệt (1 ao có 3 chu kỳ = 3 dòng)

### Diện tích
- [ ] Diện tích tính theo chu kỳ (1 ao 1000m² × 3 chu kỳ = 3000m²)
- [ ] Tổng diện tích = Σ (diện tích ao × số chu kỳ)

### Sản lượng
- [ ] Cột CC, CT, TH hiển thị đúng theo tháng
- [ ] Tổng KH = Tổng CC + Tổng CT

**Ghi chú vấn đề (nếu có):**
```
_______________________________________________
_______________________________________________
```

---

## 2️⃣ KIỂM TRA BÁO CÁO KẾ HOẠCH ĐIỀU CHỈNH

**Đường dẫn:** Báo cáo → Chọn "🔄 Kế hoạch điều chỉnh"

### Số ao/chu kỳ
- [ ] Số chu kỳ hiển thị đúng (giống báo cáo ban đầu)
- [ ] Diện tích tính đúng

### Sản lượng điều chỉnh
- [ ] Cột "Tổng KH ĐC" hiển thị sản lượng điều chỉnh
- [ ] Khác với báo cáo ban đầu (nếu có điều chỉnh)

**Ghi chú vấn đề (nếu có):**
```
_______________________________________________
_______________________________________________
```

---

## 3️⃣ KIỂM TRA BÁO CÁO THU HOẠCH

**Đường dẫn:** Báo cáo → Chọn "🚜 Kế hoạch thu & Thực thu"

### Hiển thị sản lượng
- [ ] Cột "KH thu (kg)" hiển thị kế hoạch
- [ ] Cột "Đã thu (kg)" hiển thị sản lượng thực tế
- [ ] Cột "Còn tồn (kg)" = KH thu - Đã thu
- [ ] Số liệu khớp với phiếu thu hoạch đã nhập

### Trạng thái thu hoạch
- [ ] Chu kỳ đã thu xong hiển thị "Đã thu" (màu xanh)
- [ ] Chu kỳ sắp thu hiển thị "Sắp thu" (màu vàng)
- [ ] Chu kỳ chưa thu hiển thị "Chưa thu" (màu xám)

### FCR
- [ ] Cột FCR hiển thị giá trị (nếu đã có thu hoạch)
- [ ] FCR = total_feed_used / actual_yield
- [ ] Màu sắc đúng:
  - Xanh: FCR ≤ 1.3
  - Vàng: 1.3 < FCR ≤ 1.6
  - Đỏ: FCR > 1.6

### % đạt
- [ ] Cột "% đạt" hiển thị (actual - planned) / planned × 100%
- [ ] Màu xanh nếu dương, đỏ nếu âm

**Ghi chú vấn đề (nếu có):**
```
_______________________________________________
_______________________________________________
```

---

## 4️⃣ KIỂM TRA QUẢN LÝ AO - CHU KỲ ĐÃ THU HOẠCH

**Đường dẫn:** Quản lý ao → Chọn 1 ao đã thu hoạch xong

### Cảnh báo
- [ ] KHÔNG còn hiển thị cảnh báo đỏ "ƯU TIÊN THU"
- [ ] KHÔNG còn hiển thị "NGƯNG THUỐC" (nếu đã hết thời gian)

### Tab Kế hoạch
- [ ] Hiển thị đầy đủ thông tin chu kỳ
- [ ] Sản lượng dự kiến hiển thị đúng

### Tab Thu hoạch
- [ ] Hiển thị danh sách phiếu thu hoạch
- [ ] Tổng sản lượng = Σ actual_yield của các phiếu
- [ ] FCR hiển thị chính xác

### Trạng thái chu kỳ
- [ ] Status = "CT" (nếu đã thu xong)
- [ ] harvest_done = true

**Ghi chú vấn đề (nếu có):**
```
_______________________________________________
_______________________________________________
```

---

## 5️⃣ KIỂM TRA QUẢN LÝ AO - CHU KỲ ĐANG NUÔI

**Đường dẫn:** Quản lý ao → Chọn 1 ao đang nuôi (CC)

### Cảnh báo
- [ ] Hiển thị "ƯU TIÊN THU" nếu sắp đến ngày thu (trong vòng 7 ngày)
- [ ] KHÔNG hiển thị nếu chưa đến ngày thu
- [ ] Hiển thị "NGƯNG THUỐC" nếu đang trong thời gian ngưng thuốc

### Tab Nhật ký
- [ ] Nhập được nhật ký mới
- [ ] Lũy kế thức ăn cập nhật đúng
- [ ] FCR cập nhật tự động (nếu đã có thu hoạch)

### Tab Thu hoạch
- [ ] Ghi được phiếu thu hoạch mới
- [ ] Sau khi ghi:
  - [ ] actual_yield tự động cập nhật
  - [ ] FCR tự động tính
  - [ ] Status tự động chuyển sang CT
  - [ ] Cảnh báo "ƯU TIÊN THU" tự động tắt

**Ghi chú vấn đề (nếu có):**
```
_______________________________________________
_______________________________________________
```

---

## 6️⃣ KIỂM TRA DASHBOARD

**Đường dẫn:** Trang chủ / Dashboard

### Thẻ thống kê
- [ ] "KH Gốc" hiển thị đúng
- [ ] "KH Điều chỉnh" hiển thị đúng
- [ ] "Đã thu thực tế" = Tổng actual_yield từ tất cả harvest records
- [ ] "Còn tồn chưa thu" = KH Điều chỉnh - Đã thu

### Biểu đồ
- [ ] Biểu đồ "KH vs Thực tế" hiển thị đúng theo tháng
- [ ] Biểu đồ "Phân bố FCR" hiển thị đúng

**Ghi chú vấn đề (nếu có):**
```
_______________________________________________
_______________________________________________
```

---

## 7️⃣ KIỂM TRA CHỨC NĂNG MỚI

### Nhập nhật ký
1. Chọn 1 chu kỳ đang nuôi
2. Vào tab Nhật ký
3. Nhập thức ăn (VD: 50kg)
4. Lưu nhật ký

**Kiểm tra:**
- [ ] Lũy kế thức ăn tăng thêm 50kg
- [ ] FCR tự động cập nhật (nếu đã có thu hoạch)
- [ ] Không có lỗi

### Ghi thu hoạch
1. Chọn 1 chu kỳ đang nuôi
2. Vào tab Thu hoạch
3. Nhập sản lượng (VD: 500kg)
4. Lưu phiếu thu

**Kiểm tra:**
- [ ] Phiếu thu được tạo thành công
- [ ] actual_yield = 500kg
- [ ] FCR được tính tự động
- [ ] Status chuyển sang CT
- [ ] Cảnh báo "ƯU TIÊN THU" tắt
- [ ] Báo cáo cập nhật ngay lập tức

**Ghi chú vấn đề (nếu có):**
```
_______________________________________________
_______________________________________________
```

---

## 8️⃣ KIỂM TRA TÍNH TOÁN

### Tính FCR
Chọn 1 chu kỳ đã có dữ liệu:
- Tổng thức ăn: _______ kg
- Sản lượng thu: _______ kg
- FCR hiển thị: _______
- FCR tính tay: _______ (= Thức ăn / Sản lượng)
- [ ] Khớp nhau

### Tính sản lượng còn tồn
Chọn 1 chu kỳ:
- KH thu: _______ kg
- Đã thu: _______ kg
- Còn tồn hiển thị: _______ kg
- Còn tồn tính tay: _______ kg (= KH - Đã thu)
- [ ] Khớp nhau

**Ghi chú vấn đề (nếu có):**
```
_______________________________________________
_______________________________________________
```

---

## 📊 TỔNG KẾT

### Số vấn đề phát hiện
- Nghiêm trọng (chặn sử dụng): _______
- Trung bình (ảnh hưởng chức năng): _______
- Nhỏ (giao diện, hiển thị): _______

### Đánh giá chung
- [ ] ✅ Hệ thống hoạt động tốt, sẵn sàng sử dụng
- [ ] ⚠️ Có vấn đề nhỏ, cần sửa nhưng vẫn dùng được
- [ ] ❌ Có vấn đề nghiêm trọng, cần sửa ngay

### Ghi chú tổng hợp
```
_______________________________________________
_______________________________________________
_______________________________________________
_______________________________________________
```

---

**Người kiểm tra:** _______________  
**Ngày:** _______________  
**Chữ ký:** _______________
