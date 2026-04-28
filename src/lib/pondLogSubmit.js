import { format } from 'date-fns';
import { base44 } from '@/api/base44Client';

/**
 * Tạo nhật ký + cập nhật chu kỳ + ghi PlanAdjustment khi expected_yield đổi.
 * @param {object} params
 * @param {object} params.pond — ao vật lý (id, code, …)
 * @param {object} params.cycle — pond_cycles row
 * @param {object} params.form — các field string/number như form PondLogTab
 */
export async function submitPondLogEntry({ pond, cycle, form }) {
  if (!cycle?.id) throw new Error('Thiếu chu kỳ ao (pond_cycle_id).');

  const deadFish = Number(form.dead_fish) || 0;
  const newCurrentFish = Math.max(0, (cycle.current_fish || 0) - deadFish);
  const totalFeed = (cycle.total_feed_used || 0) + (Number(form.feed_amount) || 0);

  const withdrawalEndDate =
    form.medicine_used && form.withdrawal_days
      ? format(new Date(new Date().getTime() + Number(form.withdrawal_days) * 86400000), 'yyyy-MM-dd')
      : cycle.withdrawal_end_date;

  await base44.entities.PondLog.create({
    ...form,
    pond_id: pond.id,
    pond_cycle_id: cycle.id,
    pond_code: pond.code,
    ph: Number(form.ph) || null,
    temperature: Number(form.temperature) || null,
    do: Number(form.do) || null,
    nh3: Number(form.nh3) || null,
    no2: Number(form.no2) || null,
    h2s: Number(form.h2s) || null,
    feed_amount: Number(form.feed_amount) || null,
    dead_fish: deadFish,
    withdrawal_days: Number(form.withdrawal_days) || null,
    avg_weight: Number(form.avg_weight) || null,
  });

  const prevExpectedYield = cycle.expected_yield;
  const newExpectedYield =
    cycle.survival_rate && cycle.target_weight && newCurrentFish
      ? Math.round((newCurrentFish * (cycle.survival_rate / 100) * cycle.target_weight) / 1000)
      : cycle.expected_yield;

  await base44.entities.PondCycle.update(cycle.id, {
    current_fish: newCurrentFish,
    total_feed_used: totalFeed,
    expected_yield: newExpectedYield,
    last_medicine_date: form.medicine_used ? form.log_date : cycle.last_medicine_date,
    withdrawal_days: form.withdrawal_days ? Number(form.withdrawal_days) : cycle.withdrawal_days,
    withdrawal_end_date: withdrawalEndDate,
    status: newCurrentFish > 0 ? 'CC' : 'CT',
  });

  if (newExpectedYield !== prevExpectedYield) {
    const {
      data: { user },
    } = await base44.supabase.auth.getSession();
    try {
      await base44.entities.PlanAdjustment.create({
        pond_cycle_id: cycle.id,
        adjustment_type: 'auto_loss',
        field_name: 'expected_yield',
        old_value: prevExpectedYield,
        new_value: newExpectedYield,
        reason: 'Hao hụt từ nhật ký',
        actor_id: user?.id || null,
      });
    } catch {
      /* RLS */
    }
  }

  return { newCurrentFish, newExpectedYield };
}
