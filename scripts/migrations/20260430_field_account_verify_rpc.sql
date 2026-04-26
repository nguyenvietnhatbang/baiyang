-- Bỏ cột auth_user_id nếu bạn đã chạy bản migration field_accounts cũ (có liên kết auth.users).
do $$
begin
  if exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'field_accounts' and column_name = 'auth_user_id'
  ) then
    alter table public.field_accounts drop constraint if exists field_accounts_auth_user_id_fkey;
    alter table public.field_accounts drop constraint if exists field_accounts_auth_user_key;
    drop index if exists idx_field_accounts_auth_user;
    alter table public.field_accounts drop column auth_user_id;
  end if;
end $$;

-- Gọi từ app (anon) khi /field/login — không gửi email, không Supabase signUp.
create or replace function public.field_account_verify(p_phone text, p_password text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  r record;
begin
  select fa.id, fa.phone, fa.role, fa.agency_id, fa.household_id, fa.display_name
  into r
  from public.field_accounts fa
  where fa.phone = p_phone and fa.password_plaintext = p_password
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
    'display_name', r.display_name
  );
end;
$$;

comment on function public.field_account_verify(text, text) is 'Đăng nhập hiện trường: khớp SĐT + mật khẩu trong field_accounts; trả JSON hoặc null';

revoke all on function public.field_account_verify(text, text) from public;
grant execute on function public.field_account_verify(text, text) to anon, authenticated;
