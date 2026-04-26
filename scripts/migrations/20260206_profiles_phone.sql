-- SĐT đăng nhập hiện trường (map sang email nội bộ trong app + Edge Function)
alter table public.profiles
  add column if not exists phone text;

comment on column public.profiles.phone is 'Số điện thoại chuẩn hóa (vd 84xxxxxxxxxx), đồng bộ khi admin tạo user hiện trường';

create unique index if not exists idx_profiles_phone_unique
  on public.profiles (phone)
  where phone is not null;
