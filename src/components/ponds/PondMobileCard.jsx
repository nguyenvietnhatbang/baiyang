import PondStatusBadge from './PondStatusBadge';
import { differenceInDays, parseISO } from 'date-fns';
import { formatDateDisplay } from '@/lib/dateFormat';
import { plannedHarvestDateForDisplay } from '@/lib/planReportHelpers';

export default function PondMobileCard({ pond, checked, onCheck, onClick, harvestAlertDays = 7 }) {
  const today = new Date();
  const dk = plannedHarvestDateForDisplay(pond);
  const diff = dk ? differenceInDays(parseISO(dk), today) : null;
  const isHarvested = pond?.harvest_done === true || (Number(pond?.actual_yield) || 0) > 0;
  const isUrgent = !isHarvested && diff !== null && diff <= harvestAlertDays;
  const isOverdue = diff !== null && diff < 0;
  const isWithdrawal = !isHarvested && pond.withdrawal_end_date && differenceInDays(parseISO(pond.withdrawal_end_date), today) >= 0;
  const currentFishNumber = Number(pond.current_fish);
  const hasCurrentFish = pond.current_fish != null && !Number.isNaN(currentFishNumber);

  return (
    <div
      onClick={onClick}
      className={`bg-card border rounded-xl p-4 shadow-sm cursor-pointer active:scale-[0.98] transition-transform ${
        isOverdue ? 'border-red-300 bg-red-50/30' : isUrgent ? 'border-yellow-300 bg-yellow-50/30' : 'border-border'
      }`}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="flex items-center gap-2 min-w-0">
          {(isUrgent && pond.status === 'CC') && (
            <input
              type="checkbox"
              checked={checked}
              onChange={e => { e.stopPropagation(); onCheck(e); }}
              onClick={e => e.stopPropagation()}
              className="w-4 h-4 accent-green-600 flex-shrink-0"
            />
          )}
          <div className="min-w-0">
            <p className="font-bold text-primary text-base truncate">{pond.code}</p>
            <p className="text-sm text-foreground truncate">{pond.owner_name}</p>
          </div>
        </div>
        <div className="flex flex-col items-end gap-1 flex-shrink-0">
          <PondStatusBadge status={pond.status} />
          {isUrgent && <span className="text-[10px] px-1.5 py-0.5 bg-red-100 text-red-600 rounded font-bold">THU</span>}
          {isWithdrawal && <span className="text-[10px] px-1.5 py-0.5 bg-orange-100 text-orange-600 rounded font-bold">THUỐC</span>}
        </div>
      </div>

      <div className="mt-3 grid grid-cols-3 gap-2 text-xs">
        <div className="bg-muted/50 rounded-lg p-2 text-center">
          <p className="text-muted-foreground">Diện tích</p>
          <p className="font-semibold mt-0.5">{pond.area ? `${pond.area}m²` : '—'}</p>
        </div>
        <div className="bg-muted/50 rounded-lg p-2 text-center">
          <p className="text-muted-foreground">Số cá</p>
          <p className="font-semibold mt-0.5">{hasCurrentFish ? currentFishNumber.toLocaleString() : '—'}</p>
        </div>
        <div className="bg-muted/50 rounded-lg p-2 text-center">
          <p className="text-muted-foreground">SL dự kiến</p>
          <p className="font-semibold mt-0.5">{pond.expected_yield != null ? `${Number(pond.expected_yield).toLocaleString()}kg` : '—'}</p>
        </div>
      </div>

      {(pond.fish_harvested != null ||
        pond.fish_remaining != null ||
        pond.yield_need_harvest != null ||
        pond.actual_yield != null) && (
        <div className="mt-2 space-y-2 text-xs">
          {(pond.actual_yield != null && Number.isFinite(Number(pond.actual_yield))) && (
            <div className="bg-green-50 dark:bg-green-950/30 rounded-lg p-2 text-center border border-green-200/60 dark:border-green-800/50">
              <p className="text-muted-foreground">SL thực tế (kg)</p>
              <p className="font-semibold mt-0.5 text-green-800 dark:text-green-200">
                {Number(pond.actual_yield).toLocaleString()}
              </p>
            </div>
          )}
          {pond.yield_need_harvest != null && Number.isFinite(Number(pond.yield_need_harvest)) && (
            <div className="bg-amber-50 dark:bg-amber-950/30 rounded-lg p-2 text-center border border-amber-200/60 dark:border-amber-800/50">
              <p className="text-muted-foreground">SL cần phải thu (kg)</p>
              <p className="font-semibold mt-0.5 text-amber-900 dark:text-amber-100">
                {Number(pond.yield_need_harvest).toLocaleString()}
              </p>
            </div>
          )}
          <div className="grid grid-cols-2 gap-2">
            <div className="bg-emerald-50 dark:bg-emerald-950/30 rounded-lg p-2 text-center border border-emerald-200/60 dark:border-emerald-800/50">
              <p className="text-muted-foreground">Đã thu (con)</p>
              <p className="font-semibold mt-0.5 text-emerald-800 dark:text-emerald-200">
                {pond.fish_harvested != null && !Number.isNaN(Number(pond.fish_harvested))
                  ? Number(pond.fish_harvested).toLocaleString()
                  : '—'}
              </p>
            </div>
            <div className="bg-amber-50 dark:bg-amber-950/30 rounded-lg p-2 text-center border border-amber-200/60 dark:border-amber-800/50">
              <p className="text-muted-foreground">Còn phải thu (con)</p>
              <p className="font-semibold mt-0.5 text-amber-900 dark:text-amber-100">
                {pond.fish_remaining != null && !Number.isNaN(Number(pond.fish_remaining))
                  ? Number(pond.fish_remaining).toLocaleString()
                  : '—'}
              </p>
            </div>
          </div>
        </div>
      )}

      <div className="mt-2 flex items-center justify-between text-xs text-muted-foreground">
        <span>Đại lý: <span className="font-medium text-foreground">{pond.agency_code || '—'}</span></span>
        {dk && (
          <span className={isUrgent ? 'text-red-600 font-bold' : ''}>
            Thu: {formatDateDisplay(dk)}
            {isOverdue && ' (QH)'}
          </span>
        )}
        {pond.fcr != null && (
          <span className={`px-1.5 py-0.5 rounded font-semibold ${
            pond.fcr <= 1.3 ? 'bg-green-100 text-green-700' :
            pond.fcr <= 1.6 ? 'bg-yellow-100 text-yellow-700' :
            'bg-red-100 text-red-700'
          }`}>FCR {pond.fcr}</span>
        )}
      </div>
    </div>
  );
}