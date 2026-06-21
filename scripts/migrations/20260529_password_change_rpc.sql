-- Đổi mật khẩu: tự phục vụ (hiện trường) + admin đặt lại (hiện trường & văn phòng).

create extension if not exists pgcrypto;

-- Chuẩn hóa SĐT (nếu chưa có từ migration trước)
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

-- Hiện trường: user tự đổi (cần mật khẩu cũ)
create or replace function public.field_account_change_password(
  p_phone text,
  p_old_password text,
  p_new_password text
)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  v_id uuid;
begin
  if length(coalesce(p_new_password, '')) < 6 then
    raise exception 'Mật khẩu mới tối thiểu 6 ký tự';
  end if;
  select fa.id into v_id
  from public.field_accounts fa
  where public.normalize_vn_phone(fa.phone) = public.normalize_vn_phone(p_phone)
    and fa.password_plaintext = p_old_password
  limit 1;
  if v_id is null then
    return false;
  end if;
  update public.field_accounts
  set password_plaintext = p_new_password
  where id = v_id;
  return true;
end;
$$;

revoke all on function public.field_account_change_password(text, text, text) from public;
grant execute on function public.field_account_change_password(text, text, text) to anon, authenticated;

-- Admin: đặt lại mật khẩu tài khoản hiện trường
create or replace function public.admin_set_field_account_password(
  p_account_id uuid,
  p_new_password text
)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.is_admin() then
    raise exception 'not allowed';
  end if;
  if length(coalesce(p_new_password, '')) < 6 then
    raise exception 'Mật khẩu mới tối thiểu 6 ký tự';
  end if;
  update public.field_accounts
  set password_plaintext = p_new_password
  where id = p_account_id;
  return found;
end;
$$;

revoke all on function public.admin_set_field_account_password(uuid, text) from public;
grant execute on function public.admin_set_field_account_password(uuid, text) to authenticated;

-- Admin: đặt lại mật khẩu tài khoản văn phòng (auth.users)
create or replace function public.admin_set_office_user_password(
  p_user_id uuid,
  p_new_password text
)
returns boolean
language plpgsql
security definer
set search_path = auth, public
as $$
begin
  if not public.is_admin() then
    raise exception 'not allowed';
  end if;
  if length(coalesce(p_new_password, '')) < 6 then
    raise exception 'Mật khẩu mới tối thiểu 6 ký tự';
  end if;
  update auth.users
  set
    encrypted_password = crypt(p_new_password, gen_salt('bf')),
    updated_at = now()
  where id = p_user_id;
  return found;
end;
$$;

revoke all on function public.admin_set_office_user_password(uuid, text) from public;
grant execute on function public.admin_set_office_user_password(uuid, text) to authenticated;
