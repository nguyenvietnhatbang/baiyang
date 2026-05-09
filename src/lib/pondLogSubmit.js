import { format } from 'date-fns';
import { base44 } from '@/api/base44Client';
import { calculateCurrentYield } from '@/lib/calculateYield';

/**
 * Tạo nhật ký + cập nhật chu kỳ + ghi PlanAdjustment khi expected_yield đổi.
 * @param {object} params
 * @param {object} params.pond — ao vật lý (id, code, …)
 * @param {object} params.cycle — pond_cycles row
 * @param {object} params.form — các field string/number như form PondLogTab
 */
export async function submitPondLogEntry({ pond, cycle, form }) {
  if (!cycle?.id) throw new Error('Thiếu chu kỳ ao (pond_cycle_id).');

  // Validation: Số cá hao hụt
  const deadFish = Number(form.dead_fish) || 0;
  const stockedFish = Number(form.stocked_fish) || 0;
  if (stockedFish < 0) {
    throw new Error('Số cá thả thêm không thể âm');
  }
  if (deadFish < 0) {
    throw new Error('Số cá hao hụt không thể âm');
  }
  const currentFish = cycle.current_fish || 0;
  if (deadFish > currentFish + stockedFish) {
    throw new Error(`Số cá hao hụt (${deadFish}) không thể vượt quá số cá hiện tại + thả thêm (${currentFish + stockedFish})`);
  }

  // Validation: Lượng thức ăn
  const feedAmount = Number(form.feed_amount) || 0;
  if (feedAmount < 0) {
    throw new Error('Lượng thức ăn không thể âm');
  }

  // Validation: Ngày ghi nhật ký
  const logDate = new Date(form.log_date);
  const today = new Date();
  today.setHours(23, 59, 59, 999); // So sánh đến cuối ngày
  if (logDate > today) {
    throw new Error('Ngày ghi không thể trong tương lai');
  }
  if (cycle.stock_date && logDate < new Date(cycle.stock_date)) {
    throw new Error('Ngày ghi không thể trước ngày thả');
  }

  // Validation: Tỷ lệ sống và trọng lượng mục tiêu
  if (!cycle.survival_rate || !cycle.target_weight) {
    throw new Error('Chu kỳ chưa có tỷ lệ sống hoặc trọng lượng mục tiêu. Vui lòng cập nhật thông tin chu kỳ trước.');
  }

  const newCurrentFish = Math.max(0, currentFish + stockedFish - deadFish);
  const totalFeed = (cycle.total_feed_used || 0) + feedAmount;

  // Sửa: Tính withdrawal_end_date từ log_date, không phải TODAY
  const withdrawalEndDate =
    form.medicine_used && form.withdrawal_days
      ? format(new Date(new Date(form.log_date).getTime() + Number(form.withdrawal_days) * 86400000), 'yyyy-MM-dd')
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
    stocked_fish: stockedFish,
    dead_fish: deadFish,
    withdrawal_days: Number(form.withdrawal_days) || null,
    avg_weight: Number(form.avg_weight) || null,
    growth_g: form.growth_g === '' || form.growth_g == null ? null : Number(form.growth_g) || null,
  });

  const prevExpectedYield = cycle.expected_yield;
  const newExpectedYield = calculateCurrentYield({
    ...cycle,
    current_fish: newCurrentFish
  });

  // Lấy tổng actual_yield từ harvest records
  const allHarvests = await base44.entities.HarvestRecord.filter({ pond_cycle_id: cycle.id });
  const totalActualYield = allHarvests.reduce((sum, h) => sum + (h.actual_yield || 0), 0);
  
  // Tính FCR
  let fcr = cycle.fcr;
  let fcrProvisional = false;
  if (totalActualYield > 0) {
    // FCR chính thức sau thu hoạch
    fcr = Math.round((totalFeed / totalActualYield) * 100) / 100;
    fcrProvisional = false;
  } else if (newExpectedYield > 0) {
    // FCR tạm tính dựa trên sản lượng dự kiến
    fcr = Math.round((totalFeed / newExpectedYield) * 100) / 100;
    fcrProvisional = true;
  }

  await base44.entities.PondCycle.update(cycle.id, {
    current_fish: newCurrentFish,
    total_feed_used: totalFeed,
    expected_yield: newExpectedYield,
    actual_yield: totalActualYield,
    harvest_done: totalActualYield > 0,
    fcr: fcr,
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

  return { newCurrentFish, newExpectedYield, fcrProvisional };
}
