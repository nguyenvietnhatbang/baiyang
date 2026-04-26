-- Chạy riêng trên project đã có schema my-pond-app (bổ sung cột, không sửa supabase-schema.sql gốc).
-- Ngưỡng pH / nhiệt độ mặc định cho ao mới và tham chiếu cảnh báo chất lượng nước.

alter table public.app_settings
  add column if not exists default_ph_min numeric not null default 6.5,
  add column if not exists default_ph_max numeric not null default 8.5,
  add column if not exists default_temp_min numeric not null default 25,
  add column if not exists default_temp_max numeric not null default 32;

do $$
begin
  alter table public.app_settings
    add constraint app_settings_water_ph check (default_ph_min <= default_ph_max);
exception
  when duplicate_object then null;
end $$;

do $$
begin
  alter table public.app_settings
    add constraint app_settings_water_temp check (default_temp_min <= default_temp_max);
exception
  when duplicate_object then null;
end $$;
