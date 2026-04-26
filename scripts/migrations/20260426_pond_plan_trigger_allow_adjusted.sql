-- Cho phép đại lý / chủ hộ UPDATE expected_yield, expected_harvest_date (kế hoạch điều chỉnh).
-- Giữ chặn: chỉ admin đổi đăng ký thả gốc (stock_date, total_fish, season/batch, initial_*, …).

create or replace function public.tr_enforce_pond_plan_update()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  bypass boolean;
  adm boolean;
begin
  select public.app_settings_bypass_rls() into bypass;
  if bypass then
    return new;
  end if;
  select public.is_admin() into adm;
  if adm then
    return new;
  end if;

  if (new.stock_date is distinct from old.stock_date)
     or (new.total_fish is distinct from old.total_fish)
     or (new.survival_rate is distinct from old.survival_rate)
     or (new.target_weight is distinct from old.target_weight)
     or (new.seed_size is distinct from old.seed_size)
     or (new.seed_weight is distinct from old.seed_weight)
     or (new.density is distinct from old.density)
     or (new.initial_plan_locked is distinct from old.initial_plan_locked)
     or (new.initial_expected_harvest_date is distinct from old.initial_expected_harvest_date)
     or (new.season_id is distinct from old.season_id)
     or (new.stocking_batch_id is distinct from old.stocking_batch_id)
  then
    raise exception 'Chỉ admin được sửa đăng ký / chỉ tiêu thả gốc. Đại lý và chủ hộ chỉ cập nhật kế hoạch điều chỉnh (số cá hiện tại, SL mục tiêu, ngày thu điều chỉnh).';
  end if;

  return new;
end;
$$;
