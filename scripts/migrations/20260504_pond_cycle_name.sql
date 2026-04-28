-- Tên gọi chu kỳ (tuỳ chọn), thay cho gắn vụ/đợt thả trong UI.
alter table public.pond_cycles add column if not exists name text;
