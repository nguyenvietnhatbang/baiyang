# 🔧 SỬA LỖI HỆ THỐNG - HƯỚNG DẪN NHANH

## ✅ Đã sửa xong 4/4 vấn đề

1. ✅ Báo cáo đếm sai số ao/diện tích
2. ✅ Báo cáo chưa hiển thị sản lượng đã thu
3. ✅ Chu kỳ đã thu vẫn cảnh báo
4. ✅ Nhật ký chưa cập nhật FCR

---

## 🚀 3 BƯỚC ĐỂ SỬ DỤNG

### Bước 1: Đọc tóm tắt
```bash
cat SUMMARY.md
```

### Bước 2: Đồng bộ dữ liệu (BẮT BUỘC)
1. Mở app trong trình duyệt
2. Nhấn F12 → Console
3. Copy/paste script trong `docs/DONG_BO_DU_LIEU.md`
4. Tải lại trang (F5)

### Bước 3: Kiểm tra
Dùng `CHECKLIST_KIEM_TRA.md` để kiểm tra từng phần

---

## 📚 TÀI LIỆU

| File | Mục đích |
|------|----------|
| **SUMMARY.md** | Tóm tắt nhanh (ĐỌC ĐẦU TIÊN) |
| **docs/CAP_NHAT_HE_THONG.md** | Hướng dẫn cập nhật chi tiết |
| **docs/TOM_TAT_SUA_LOI.md** | Chi tiết từng vấn đề đã sửa |
| **docs/DONG_BO_DU_LIEU.md** | Hướng dẫn đồng bộ dữ liệu |
| **CHECKLIST_KIEM_TRA.md** | Checklist kiểm tra hệ thống |
| **HOAN_THANH.txt** | Thông báo hoàn thành |

---

## ⚡ SCRIPT ĐỒNG BỘ NHANH

Mở Console (F12) và chạy:

```javascript
(async () => {
  const { syncPondCyclesWithHarvests } = await import('/src/lib/pondCycleSync.js');
  await syncPondCyclesWithHarvests();
})();
```

Sau đó nhấn F5 để tải lại trang.

---

## 📊 KIỂM TRA NHANH

Sau khi đồng bộ, kiểm tra 3 điều:

1. **Báo cáo Kế hoạch ban đầu**
   - Số chu kỳ đúng? ✓
   - Diện tích đúng? ✓

2. **Báo cáo Thu hoạch**
   - Cột "Đã thu" có số liệu? ✓
   - FCR hiển thị? ✓

3. **Quản lý ao**
   - Chu kỳ đã thu không còn cảnh báo? ✓

---

## 🎯 KẾT QUẢ

- ✅ Báo cáo đếm đúng chu kỳ
- ✅ Hiển thị sản lượng đã thu
- ✅ Cảnh báo thông minh
- ✅ FCR tự động cập nhật

**Hệ thống sẵn sàng!** 🎉

---

## 📞 Cần hỗ trợ?

1. Đọc `docs/CAP_NHAT_HE_THONG.md`
2. Kiểm tra Console (F12) để xem lỗi
3. Dùng `CHECKLIST_KIEM_TRA.md`
