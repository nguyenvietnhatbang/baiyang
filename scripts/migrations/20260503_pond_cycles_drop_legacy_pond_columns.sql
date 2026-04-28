-- Chạy SAU khi app đã dùng pond_cycles (không còn đọc/ghi cột nghiệp vụ trên ponds).
-- Idempotent: dùng IF EXISTS qua information_schema khi cần.

alter table public.ponds drop column if exists season_id;
alter table public.ponds drop column if exists stocking_batch_id;
alter table public.ponds drop column if exists status;
alter table public.ponds drop column if exists stock_date;
alter table public.ponds drop column if exists total_fish;
alter table public.ponds drop column if exists current_fish;
alter table public.ponds drop column if exists seed_size;
alter table public.ponds drop column if exists seed_weight;
alter table public.ponds drop column if exists density;
alter table public.ponds drop column if exists survival_rate;
alter table public.ponds drop column if exists target_weight;
alter table public.ponds drop column if exists expected_harvest_date;
alter table public.ponds drop column if exists initial_plan_locked;
alter table public.ponds drop column if exists initial_expected_harvest_date;
alter table public.ponds drop column if exists expected_yield;
alter table public.ponds drop column if exists actual_yield;
alter table public.ponds drop column if exists harvest_done;
alter table public.ponds drop column if exists total_feed_used;
alter table public.ponds drop column if exists fcr;
alter table public.ponds drop column if exists last_medicine_date;
alter table public.ponds drop column if exists withdrawal_days;
alter table public.ponds drop column if exists withdrawal_end_date;
alter table public.ponds drop column if exists notes;

drop index if exists idx_ponds_season_id;
drop index if exists idx_ponds_stocking_batch_id;
drop index if exists idx_ponds_status;
drop index if exists idx_ponds_expected_harvest_date;
