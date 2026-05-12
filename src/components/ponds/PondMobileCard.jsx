import PondStatusBadge from './PondStatusBadge';
import { formatDateDisplay } from '@/lib/dateFormat';
import { plannedHarvestDateForDisplay } from '@/lib/planReportHelpers';
import { calendarDaysUntilHarvest, isCycleHarvestCompleteForAlerts, isHarvestDateOnOrBeforeToday, isHarvestDateWithinUpcomingDays } from '@/lib/harvestAlerts';

export default function PondMobileCard({ pond, checked, onCheck, onClick, harvestAlertDays = 7 }) {
  const today = new Date();
  const cycleIsCc = String(pond.status ?? '').toUpperCase() === 'CC';
  const dk =
    pond.expected_harvest_date != null && String(pond.expected_harvest_date).trim() !== ''
      ? pond.expected_harvest_date
      : plannedHarvestDateForDisplay(pond);
  const diff = calendarDaysUntilHarvest(dk, today);
  const harvestComplete = isCycleHarvestCompleteForAlerts(pond);
  const isUrgent = !harvestComplete && isHarvestDateOnOrBeforeToday(diff);
  const isUpcomingHarvest =
    !harvestComplete && isHarvestDateWithinUpcomingDays(diff, harvestAlertDays);
  const isOverdue = !harvestComplete && diff !== null && diff < 0;
  const withdrawalDiff = pond.withdrawal_end_date ? calendarDaysUntilHarvest(pond.withdrawal_end_date, today) : null;
  const isWithdrawal =
    !harvestComplete &&
    pond.withdrawal_end_date &&
    withdrawalDiff !== null &&
    withdrawalDiff >= 0;
  const currentFishNumber = Number(pond.current_fish);
  const hasCurrentFish = pond.current_fish != null && !Number.isNaN(currentFishNumber);

  return (
    <div
      onClick={onClick}
      className={`bg-card border rounded-xl p-4 shadow-sm cursor-pointer active:scale-[0.98] transition-transform ${
        isOverdue ? 'border-red-300 bg-red-50/30' : isUrgent ? 'border-yellow-300 bg-yellow-50/30' : isUpcomingHarvest ? 'border-amber-200/80 bg-amber-50/20' : 'border-border'
      }`}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="flex items-center gap-2 min-w-0">
          {(isUrgent && cycleIsCc) && (
            <input
              type="checkbox"
              checked={checked}
              onChange={e => { e.stopPropagation(); onCheck(e); }}
              onClick={e => e.stopPropagation()}
              className="w-5 h-5 accent-green-600 flex-shrink-0"
            />
          )}
          <div className="min-w-0">
            <p className="font-bold text-lg text-primary truncate">{pond.code}</p>
            <p className="text-base font-semibold text-foreground truncate">{pond.owner_name}</p>
          </div>
        </div>
        <div className="flex flex-col items-end gap-1 flex-shrink-0">
          <PondStatusBadge status={pond.status} />
          {isUrgent && (
            <span className="text-xs px-2 py-0.5 bg-red-100 text-red-600 rounded font-extrabold">THU</span>
          )}
          {isUpcomingHarvest && (
            <span className="text-xs px-2 py-0.5 bg-amber-100 text-amber-800 rounded font-extrabold">SẮP THU</span>
          )}
          {isWithdrawal && <span className="text-xs px-2 py-0.5 bg-orange-100 text-orange-600 rounded font-extrabold">THUỐC</span>}
        </div>
      </div>

      <div className="mt-3 grid grid-cols-3 gap-2 text-sm">
        <div className="bg-muted/50 rounded-lg p-2.5 text-center">
          <p className="text-muted-foreground font-semibold">Diện tích</p>
          <p className="font-bold mt-0.5">{pond.area ? `${pond.area}m²` : '—'}</p>
        </div>
        <div className="bg-muted/50 rounded-lg p-2.5 text-center">
          <p className="text-muted-foreground font-semibold">Số cá</p>
          <p className="font-bold mt-0.5">{hasCurrentFish ? currentFishNumber.toLocaleString() : '—'}</p>
        </div>
        <div className="bg-muted/50 rounded-lg p-2.5 text-center">
          <p className="text-muted-foreground font-semibold">SL dự kiến</p>
          <p className="font-bold mt-0.5">{pond.expected_yield != null ? `${Number(pond.expected_yield).toLocaleString()}kg` : '—'}</p>
        </div>
      </div>

      {(pond.fish_harvested != null ||
        pond.fish_remaining != null ||
        pond.yield_need_harvest != null ||
        pond.actual_yield != null) && (
        <div className="mt-2 space-y-2 text-sm">
          {(pond.actual_harvest_display_kg != null && Number.isFinite(Number(pond.actual_harvest_display_kg))) ||
          (pond.actual_yield != null && Number.isFinite(Number(pond.actual_yield))) ? (
            <div className="bg-green-50 dark:bg-green-950/30 rounded-lg p-2 text-center border border-green-200/60 dark:border-green-800/50">
              <p className="text-muted-foreground font-semibold">SL thực tế (kg)</p>
              <p className="font-bold mt-0.5 text-green-800 dark:text-green-200">
                {Number(pond.actual_harvest_display_kg ?? pond.actual_yield).toLocaleString()}
              </p>
            </div>
          ) : null}
          {pond.yield_need_harvest != null && Number.isFinite(Number(pond.yield_need_harvest)) && (
            <div className="bg-amber-50 dark:bg-amber-950/30 rounded-lg p-2 text-center border border-amber-200/60 dark:border-amber-800/50">
              <p className="text-muted-foreground font-semibold">SL cần phải thu (kg)</p>
              <p className="font-bold mt-0.5 text-amber-900 dark:text-amber-100">
                {Number(pond.yield_need_harvest).toLocaleString()}
              </p>
            </div>
          )}
          <div className="grid grid-cols-2 gap-2">
            <div className="bg-emerald-50 dark:bg-emerald-950/30 rounded-lg p-2 text-center border border-emerald-200/60 dark:border-emerald-800/50">
              <p className="text-muted-foreground font-semibold">Đã thu (con)</p>
              <p className="font-bold mt-0.5 text-emerald-800 dark:text-emerald-200">
                {pond.fish_harvested != null && !Number.isNaN(Number(pond.fish_harvested))
                  ? Number(pond.fish_harvested).toLocaleString()
                  : '—'}
              </p>
            </div>
            <div className="bg-amber-50 dark:bg-amber-950/30 rounded-lg p-2 text-center border border-amber-200/60 dark:border-amber-800/50">
              <p className="text-muted-foreground font-semibold">Còn phải thu (con)</p>
              <p className="font-bold mt-0.5 text-amber-900 dark:text-amber-100">
                {pond.fish_remaining != null && !Number.isNaN(Number(pond.fish_remaining))
                  ? Number(pond.fish_remaining).toLocaleString()
                  : '—'}
              </p>
            </div>
          </div>
        </div>
      )}

      <div className="mt-2 flex items-center justify-between text-sm font-semibold text-muted-foreground">
        <span>Đại lý: <span className="font-bold text-foreground">{pond.agency_code || '—'}</span></span>
        {dk && (
          <span className={isUrgent ? 'text-red-600 font-extrabold' : isUpcomingHarvest ? 'text-amber-800 font-bold' : 'font-semibold text-foreground'}>
            Thu: {formatDateDisplay(dk)}
            {pond.harvest_date_estimated && <span className="text-muted-foreground font-normal"> (ước)</span>}
            {isOverdue && ' (QH)'}
          </span>
        )}
        {pond.fcr != null && (
          <span className={`px-2 py-0.5 rounded text-xs font-extrabold ${
            pond.fcr <= 1.3 ? 'bg-green-100 text-green-700' :
            pond.fcr <= 1.6 ? 'bg-yellow-100 text-yellow-700' :
            'bg-red-100 text-red-700'
          }`}>FCR {pond.fcr}</span>
        )}
      </div>
    </div>
  );
}