-- Tài khoản hiện trường: mật khẩu plaintext + phạm vi đại lý/hộ. Không liên kết auth.users.
-- Đăng nhập: RPC field_account_verify (file migration 20260430) + session trên trình duyệt.

create table if not exists public.field_accounts (
  id uuid primary key default gen_random_uuid(),
  phone text not null,
  password_plaintext text not null,
  role text not null check (role in ('agency', 'household_owner')),
  agency_id uuid references public.agencies (id) on delete set null,
  household_id uuid references public.households (id) on delete set null,
  display_name text,
  created_at timestamptz not null default timezone('utc', now()),
  constraint field_accounts_phone_key unique (phone),
  constraint field_accounts_scope_chk check (
    (role = 'agency' and agency_id is not null and household_id is null)
    or (role = 'household_owner' and household_id is not null)
  )
);

comment on table public.field_accounts is 'Đăng nhập hiện trường: SĐT + mật khẩu lưu DB (tiện ích nội bộ), không Supabase Auth';

alter table public.field_accounts enable row level security;

drop policy if exists field_accounts_admin_all on public.field_accounts;
create policy field_accounts_admin_all on public.field_accounts
  for all
  using (public.is_admin())
  with check (public.is_admin());
