# HƯỚNG DẪN ĐỒNG BỘ DỮ LIỆU

## Tại sao cần đồng bộ?

Sau khi cập nhật hệ thống, các chu kỳ ao nuôi cũ chưa có:
- `actual_yield` (sản lượng thực thu)
- `fcr` (hệ số chuyển đổi thức ăn)
- `harvest_done` (đã thu hoạch xong chưa)

Script đồng bộ sẽ tự động:
1. Tính tổng `actual_yield` từ tất cả phiếu thu hoạch
2. Tính `FCR` = `total_feed_used` / `actual_yield`
3. Cập nhật `harvest_done = true` nếu đã có thu hoạch
4. Chuyển `status = 'CT'` nếu đã thu hoạch xong

---

## Cách chạy đồng bộ

### Bước 1: Mở ứng dụng trong trình duyệt
- Đăng nhập vào hệ thống
- Mở trang bất kỳ (Dashboard, Báo cáo, v.v.)

### Bước 2: Mở DevTools Console
- Nhấn **F12** (hoặc Ctrl+Shift+I trên Windows/Linux, Cmd+Option+I trên Mac)
- Chọn tab **Console**

### Bước 3: Dán và chạy script

**Copy đoạn code sau và paste vào Console:**

```javascript
(async () => {
  console.log('🚀 Bắt đầu đồng bộ hóa dữ liệu...\n');
  
  try {
    const { syncPondCyclesWithHarvests } = await import('/src/lib/pondCycleSync.js');
    const result = await syncPondCyclesWithHarvests();
    
    console.log('\n✅ Đồng bộ hóa hoàn tất!');
    console.log(`📊 Tổng số chu kỳ: ${result.totalCycles}`);
    console.log(`🔄 Đã cập nhật: ${result.updatedCount}`);
    
    if (result.updatedCount > 0) {
      console.log('\n💡 Các thay đổi đã được áp dụng:');
      console.log('- actual_yield được cập nhật từ tổng HarvestRecord');
      console.log('- FCR được tính toán lại dựa trên total_feed_used và actual_yield');
      console.log('- harvest_done được cập nhật nếu có actual_yield > 0');
      console.log('- status được chuyển thành CT nếu đã thu hoạch');
      console.log('\n🔄 Vui lòng tải lại trang để thấy kết quả!');
    } else {
      console.log('\nℹ️ Không có thay đổi nào cần thiết, dữ liệu đã đồng bộ.');
    }
    
  } catch (error) {
    console.error('\n❌ Lỗi khi đồng bộ hóa:', error.message);
    console.error('Chi tiết:', error);
  }
})();
```

### Bước 4: Chờ kết quả
- Script sẽ hiển thị tiến trình trong Console
- Khi hoàn tất, bạn sẽ thấy thông báo "✅ Đồng bộ hóa hoàn tất!"

### Bước 5: Tải lại trang
- Nhấn **F5** hoặc **Ctrl+R** để tải lại trang
- Kiểm tra báo cáo để xem kết quả

---

## Kiểm tra kết quả

Sau khi đồng bộ, kiểm tra:

1. **Trang Báo cáo → Kế hoạch thu & Thực thu**
   - Cột "Đã thu (kg)" phải hiển thị đúng số liệu
   - Cột "FCR" phải hiển thị giá trị (nếu có dữ liệu)
   - Trạng thái thu hoạch phải đúng (Đã thu / Sắp thu / Chưa thu)

2. **Trang Quản lý ao → Tab Thu hoạch**
   - Chu kỳ đã thu hoạch không còn cảnh báo "ƯU TIÊN THU"
   - FCR hiển thị chính xác

3. **Trang Dashboard**
   - Số liệu "Đã thu thực tế" phải khớp với tổng phiếu thu hoạch

---

## Xử lý lỗi

### Lỗi: "Cannot find module"
- **Nguyên nhân:** Chưa đăng nhập hoặc file không tồn tại
- **Giải pháp:** Đăng nhập lại và thử lại

### Lỗi: "Permission denied"
- **Nguyên nhân:** Tài khoản không có quyền cập nhật
- **Giải pháp:** Đăng nhập bằng tài khoản Admin

### Lỗi: "Network error"
- **Nguyên nhân:** Mất kết nối internet
- **Giải pháp:** Kiểm tra kết nối và thử lại

---

## Lưu ý quan trọng

⚠️ **Chỉ cần chạy 1 lần** sau khi cập nhật hệ thống
⚠️ **Dữ liệu mới** sẽ tự động đồng bộ, không cần chạy lại
⚠️ **Backup dữ liệu** trước khi chạy (nếu cần)

---

## Hỗ trợ

Nếu gặp vấn đề, liên hệ:
- Kiểm tra Console để xem thông báo lỗi chi tiết
- Chụp màn hình lỗi và gửi cho team kỹ thuật
