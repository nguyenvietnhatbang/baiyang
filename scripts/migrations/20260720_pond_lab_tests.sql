-- Kết quả kiểm nghiệm kháng sinh / hóa chất theo ao (mẫu TIEN PHONG LAB).

create table if not exists public.pond_lab_tests (
  id uuid primary key default gen_random_uuid(),
  pond_id uuid not null references public.ponds(id) on update cascade on delete cascade,
  pond_cycle_id uuid references public.pond_cycles(id) on update cascade on delete set null,
  report_code text,
  lab_name text not null default 'TIEN PHONG LAB',
  customer_name text,
  sample_info text,
  address text,
  sample_received_date date,
  result_date date,
  analytes jsonb not null default '[]'::jsonb,
  notes text,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create index if not exists idx_pond_lab_tests_pond_id on public.pond_lab_tests(pond_id);
create index if not exists idx_pond_lab_tests_pond_cycle_id on public.pond_lab_tests(pond_cycle_id);
create index if not exists idx_pond_lab_tests_result_date on public.pond_lab_tests(result_date desc);

drop trigger if exists trg_pond_lab_tests_updated_at on public.pond_lab_tests;
create trigger trg_pond_lab_tests_updated_at
before update on public.pond_lab_tests
for each row execute function public.set_updated_at();

alter table public.pond_lab_tests enable row level security;

drop policy if exists pond_lab_tests_all on public.pond_lab_tests;
create policy pond_lab_tests_all on public.pond_lab_tests
  for all using (
    public.app_settings_bypass_rls()
    or public.is_admin()
    or exists (
      select 1 from public.ponds po join public.profiles pr on pr.id = auth.uid()
      where po.id = pond_lab_tests.pond_id
        and (
          pr.role = 'agency' and pr.agency_id = (select agency_id from public.agencies a where a.code = po.agency_code limit 1)
          or pr.household_id = po.household_id
        )
    )
  )
  with check (
    public.app_settings_bypass_rls()
    or public.is_admin()
    or exists (
      select 1 from public.ponds po join public.profiles pr on pr.id = auth.uid()
      where po.id = pond_lab_tests.pond_id
        and (
          pr.role = 'agency' and pr.agency_id = (select agency_id from public.agencies a where a.code = po.agency_code limit 1)
          or pr.household_id = po.household_id
        )
    )
  );
