-- Khôi phục: tự đổi MK hiện trường phải nhập mật khẩu cũ (nếu đã chạy bản RPC 2 tham số trước đó).

drop function if exists public.field_account_change_password(text, text);

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
