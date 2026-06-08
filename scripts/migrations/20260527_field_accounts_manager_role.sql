-- Vai trò Quản lý: phân công nhiều khu vực (region_codes) trên field_accounts.

alter table public.field_accounts
  add column if not exists region_codes text[] not null default '{}';

alter table public.field_accounts drop constraint if exists field_accounts_role_check;
alter table public.field_accounts
  add constraint field_accounts_role_check
  check (role in ('agency', 'household_owner', 'manager'));

alter table public.field_accounts drop constraint if exists field_accounts_scope_chk;
alter table public.field_accounts
  add constraint field_accounts_scope_chk check (
    (
      role = 'agency'
      and agency_id is not null
      and household_id is null
      and coalesce(array_length(region_codes, 1), 0) = 0
    )
    or (
      role = 'household_owner'
      and household_id is not null
      and coalesce(array_length(region_codes, 1), 0) = 0
    )
    or (
      role = 'manager'
      and agency_id is null
      and household_id is null
      and coalesce(array_length(region_codes, 1), 0) > 0
    )
  );

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
    'display_name', r.display_name,
    'region_codes', coalesce(r.region_codes, '{}'::text[])
  );
end;
$$;

comment on column public.field_accounts.region_codes is 'Vai trò manager: danh sách mã khu vực (region_codes.code) được phân công';

-- Admin UI: liệt kê tài khoản văn phòng (email + profile)
create or replace function public.list_office_auth_users()
returns jsonb
language plpgsql
security definer
set search_path = public, auth
as $$
begin
  if not public.is_admin() then
    raise exception 'not allowed';
  end if;
  return coalesce((
    select jsonb_agg(row order by row->>'created_at' desc)
    from (
      select jsonb_build_object(
        'id', u.id,
        'email', u.email,
        'role', p.role,
        'display_name', p.display_name,
        'phone', p.phone,
        'created_at', u.created_at
      ) as row
      from auth.users u
      join public.profiles p on p.id = u.id
    ) s
  ), '[]'::jsonb);
end;
$$;

revoke all on function public.list_office_auth_users() from public;
grant execute on function public.list_office_auth_users() to authenticated;
