-- Thêm cột sort_order cho bảng seasons (nếu DB cũ chưa có).
-- Chạy một lần trên Supabase SQL Editor nếu muốn sắp xếp vụ theo thứ tự tùy chỉnh.
alter table public.seasons
  add column if not exists sort_order int not null default 0;
