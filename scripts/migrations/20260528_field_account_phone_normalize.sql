-- Đăng nhập hiện trường: khớp SĐT linh hoạt (0386… / 84386… / 386…).

alter table public.field_accounts
  add column if not exists region_codes text[] not null default '{}';

create or replace function public.normalize_vn_phone(raw text)
returns text
language sql
immutable
as $$
  select case
    when d ~ '^84[0-9]{9,}$' then '0' || substring(d from 3)
    when d ~ '^0[0-9]{9,}$' then d
    when length(d) >= 9 then '0' || d
    else d
  end
  from (select regexp_replace(coalesce(raw, ''), '[^0-9]', '', 'g') as d) s;
$$;

create or replace function public.field_account_verify(p_phone text, p_password text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  r record;
begin
  select fa.id, fa.phone, fa.role, fa.agency_id, fa.household_id, fa.display_name, fa.region_codes
  into r
  from public.field_accounts fa
  where public.normalize_vn_phone(fa.phone) = public.normalize_vn_phone(p_phone)
    and fa.password_plaintext = p_password
  limit 1;
  if not found then
    return null;
  end if;
  return jsonb_build_object(
    'id', r.id,
    'phone', r.phone,
    'role', r.role,
    'agency_id', r.agency_id,
    'household_id', r.household_id,
    'display_name', r.display_name,
    'region_codes', coalesce(r.region_codes, '{}'::text[])
  );
end;
$$;

comment on function public.normalize_vn_phone(text) is 'Chuẩn hóa SĐT VN về dạng 0 + 9 số';
