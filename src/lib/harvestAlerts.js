import { differenceInDays, parseISO } from 'date-fns';
import { plannedHarvestDateForDisplay } from '@/lib/planReportHelpers';

/** @param {{ harvest_alert_days?: number } | null | undefined} settings */
export function getHarvestAlertDays(settings) {
  const n = settings?.harvest_alert_days;
  return typeof n === 'number' && n >= 0 ? n : 7;
}

/**
 * @param {object} pond
 * @param {number} totalHarvestedKg — sum(actual_yield) for pond
 * @param {number} alertDays
 * @returns {'harvested'|'upcoming'|'not_ready'}
 */
export function classifyHarvestStatus(pond, totalHarvestedKg, alertDays) {
  const planned = pond.expected_yield || 0;
  const plannedHarvestDate = plannedHarvestDateForDisplay(pond);
  if (pond.harvest_done || (totalHarvestedKg > 0 && planned > 0 && totalHarvestedKg >= planned)) {
    return 'harvested';
  }
  if (!plannedHarvestDate) {
    return 'not_ready';
  }
  const today = new Date();
  const diff = differenceInDays(parseISO(plannedHarvestDate), today);
  if (diff <= alertDays) {
    return 'upcoming';
  }
  return 'not_ready';
}

export function harvestStatusLabel(status) {
  if (status === 'harvested') return 'Đã thu';
  if (status === 'upcoming') return 'Sắp thu';
  return 'Chưa thu';
}
