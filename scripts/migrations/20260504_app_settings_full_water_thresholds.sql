-- Bổ sung đầy đủ ngưỡng chất lượng nước vào app_settings
-- Migration: 20260504_app_settings_full_water_thresholds.sql
-- Thêm: DO, NH3, NO2, H2S

-- Thêm các cột ngưỡng còn thiếu
alter table public.app_settings
  add column if not exists default_do_min numeric not null default 5,
  add column if not exists default_do_max numeric not null default 12,
  add column if not exists default_nh3_min numeric not null default 0,
  add column if not exists default_nh3_max numeric not null default 0.3,
  add column if not exists default_no2_min numeric not null default 0,
  add column if not exists default_no2_max numeric not null default 0.05,
  add column if not exists default_h2s_min numeric not null default 0,
  add column if not exists default_h2s_max numeric not null default 0.02;

-- Thêm constraints để đảm bảo min <= max
do $$
begin
  alter table public.app_settings
    add constraint app_settings_water_do check (default_do_min <= default_do_max);
exception
  when duplicate_object then null;
end $$;

do $$
begin
  alter table public.app_settings
    add constraint app_settings_water_nh3 check (default_nh3_min <= default_nh3_max);
exception
  when duplicate_object then null;
end $$;

do $$
begin
  alter table public.app_settings
    add constraint app_settings_water_no2 check (default_no2_min <= default_no2_max);
exception
  when duplicate_object then null;
end $$;

do $$
begin
  alter table public.app_settings
    add constraint app_settings_water_h2s check (default_h2s_min <= default_h2s_max);
exception
  when duplicate_object then null;
end $$;

-- Comment để giải thích
comment on column public.app_settings.default_do_min is 'Oxy hòa tan tối thiểu (mg/L)';
comment on column public.app_settings.default_do_max is 'Oxy hòa tan tối đa (mg/L)';
comment on column public.app_settings.default_nh3_min is 'NH3 tối thiểu (mg/L)';
comment on column public.app_settings.default_nh3_max is 'NH3 tối đa (mg/L)';
comment on column public.app_settings.default_no2_min is 'NO2 tối thiểu (mg/L)';
comment on column public.app_settings.default_no2_max is 'NO2 tối đa (mg/L)';
comment on column public.app_settings.default_h2s_min is 'H2S tối thiểu (mg/L)';
comment on column public.app_settings.default_h2s_max is 'H2S tối đa (mg/L)';
