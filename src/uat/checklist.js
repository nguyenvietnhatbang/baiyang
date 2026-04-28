/**
 * UAT matrix — chạy thủ công sau khi deploy.
 * Export dùng cho tài liệu nội bộ / QA.
 */
export const UAT_PHASES = [
  {
    phase: 'Pha 2 — Master + mã ao',
    cases: [
      'Tạo đại lý với pond_code_segment; mã đại lý trim/uppercase; lỗi 23505 hiển thị thân thiện',
      'Tạo hộ nuôi (region + segment 3 số); trùng segment trong cùng đại lý bị chặn',
      'Tạo ao: mã sinh qua next_pond_code; QR gắn đúng mã; không sửa mã khi không phải admin',
    ],
  },
  {
    phase: 'Pha 3 — Phân quyền',
    cases: [
      'Admin sửa được Kế hoạch; đại lý/chủ hộ thấy form kế hoạch read-only',
      'Ghi plan_adjustment khi admin nhập lý do công ty; auto_loss khi hao hụt từ nhật ký',
      'RLS: tắt bypass_rls trên app_settings; kiểm tra agency/household chỉ thấy phạm vi',
    ],
  },
  {
    phase: 'Pha 4 — FCR',
    cases: [
      'Sau khi có HarvestRecord, ponds.fcr = total_feed / sum(actual_yield); đổi feed cập nhật lại',
      'sum_pond_feed + lọc ngày trên trang Nhật ký / tab nhật ký',
    ],
  },
  {
    phase: 'Pha 5 — Báo cáo + cảnh báo',
    cases: [
      'Lọc báo cáo theo chu kỳ / đại lý; cột diện tích + FCR + nhóm Đã/Sắp/Chưa thu',
      'Đổi harvest_alert_days trong Cài đặt; Dashboard / Ao / Banner đồng bộ ngưỡng',
      'Xuất CSV báo cáo thu',
    ],
  },
];
