import { format } from 'date-fns';
import { base44 } from '@/api/base44Client';

/**
 * Tạo nhật ký + cập nhật ao + ghi PlanAdjustment khi expected_yield đổi (giống PondLogTab).
 * @param {object} params
 * @param {object} params.pond
 * @param {object} params.form — các field string/number như form PondLogTab
 */
export async function submitPondLogEntry({ pond, form }) {
  const deadFish = Number(form.dead_fish) || 0;
  const newCurrentFish = Math.max(0, (pond.current_fish || 0) - deadFish);
  const totalFeed = (pond.total_feed_used || 0) + (Number(form.feed_amount) || 0);

  const withdrawalEndDate =
    form.medicine_used && form.withdrawal_days
      ? format(new Date(new Date().getTime() + Number(form.withdrawal_days) * 86400000), 'yyyy-MM-dd')
      : pond.withdrawal_end_date;

  await base44.entities.PondLog.create({
    ...form,
    pond_id: pond.id,
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

  const prevExpectedYield = pond.expected_yield;
  const newExpectedYield =
    pond.survival_rate && pond.target_weight && newCurrentFish
      ? Math.round(newCurrentFish * (pond.survival_rate / 100) * pond.target_weight / 1000)
      : pond.expected_yield;

  await base44.entities.Pond.update(pond.id, {
    current_fish: newCurrentFish,
    total_feed_used: totalFeed,
    expected_yield: newExpectedYield,
    last_medicine_date: form.medicine_used ? form.log_date : pond.last_medicine_date,
    withdrawal_days: form.withdrawal_days ? Number(form.withdrawal_days) : pond.withdrawal_days,
    withdrawal_end_date: withdrawalEndDate,
  });

  if (newExpectedYield !== prevExpectedYield) {
    const {
      data: { user },
    } = await base44.supabase.auth.getSession();
    try {
      await base44.entities.PlanAdjustment.create({
        pond_id: pond.id,
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
