import { useMemo } from 'react';
import { MoreHorizontal, Eye, Edit, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import PondStatusBadge from '@/components/ponds/PondStatusBadge';
import PondMobileCard from '@/components/ponds/PondMobileCard';
import { formatDateDisplay } from '@/lib/dateFormat';
import {
  calendarDaysUntilHarvest,
  isCycleHarvestCompleteForAlerts,
  isHarvestDateOnOrBeforeToday,
  isHarvestDateWithinUpcomingDays,
} from '@/lib/harvestAlerts';
import PondTableFilterControls from '@/components/ponds/PondTableFilterControls';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
} from '@/components/ui/dropdown-menu';

export default function PondCycleListTabPanel({
  variant,
  rows,
  totals,
  loading,
  search,
  setSearch,
  statusFilters,
  setStatusFilters,
  statusFilterItems,
  agencyFilters,
  setAgencyFilters,
  agencyFilterItems,
  householdFilters,
  setHouseholdFilters,
  householdFilterItems,
  cycleDateField,
  setCycleDateField,
  cycleDateFrom,
  setCycleDateFrom,
  cycleDateTo,
  setCycleDateTo,
  checkedHarvest,
  setCheckedHarvest,
  toggleHarvestCheck,
  handleConfirmHarvest,
  confirming,
  today,
  visibleCols,
  columnDefs,
  setViewCycleId,
  setViewPondId,
  setEditCycleId,
  setSelectedPond,
  setShowEditDialog,
  setDeleteCycleId,
  setDeleteCycleLabel,
  setShowDeleteConfirm,
  harvestAlertDays = 7,
}) {
  const isHarvestedView = variant === 'harvested';
  const emptyListHint = isHarvestedView ? 'Không có chu kỳ đã thu hoạch' : 'Không tìm thấy chu kỳ nào';

  /** Chỉ render ô dữ liệu khi cột có trong columnDefs — tránh lệch với thead (tab Chu kỳ không có cột cá đã thu). */
  const defKeys = useMemo(() => new Set(columnDefs.map((c) => c.key)), [columnDefs]);

  return (
    <>
      {!isHarvestedView && checkedHarvest.size > 0 && (
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 bg-green-50 border border-green-200 rounded-lg px-4 py-3">
          <p className="text-base font-semibold text-green-800">
            Đã chọn <strong className="font-extrabold">{checkedHarvest.size}</strong> chu kỳ để chốt thu hoạch
          </p>
          <div className="flex gap-2">
            <Button variant="outline" size="default" className="text-base font-bold h-10" onClick={() => setCheckedHarvest(new Set())}>
              Bỏ chọn
            </Button>
            <Button size="default" className="bg-green-600 hover:bg-green-700 text-white text-base font-bold h-10" onClick={handleConfirmHarvest} disabled={confirming}>
              {confirming ? 'Đang xử lý...' : '✅ Xác nhận đã thu'}
            </Button>
          </div>
        </div>
      )}

      <PondTableFilterControls
        search={search}
        setSearch={setSearch}
        searchPlaceholder="Tìm mã ao, tên chủ hộ, tên chu kỳ…"
        statusFilterItems={statusFilterItems}
        statusFilters={statusFilters}
        setStatusFilters={setStatusFilters}
        agencyFilterItems={agencyFilterItems}
        agencyFilters={agencyFilters}
        setAgencyFilters={setAgencyFilters}
        householdFilterItems={householdFilterItems}
        householdFilters={householdFilters}
        setHouseholdFilters={setHouseholdFilters}
        showDateRange
        dateField={cycleDateField}
        setDateField={setCycleDateField}
        dateFrom={cycleDateFrom}
        setDateFrom={setCycleDateFrom}
        dateTo={cycleDateTo}
        setDateTo={setCycleDateTo}
      />

      <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-7 gap-2">
        <div className="rounded-lg border border-border bg-card p-2.5">
          <p className="text-xs font-extrabold text-muted-foreground uppercase tracking-wide">Tổng ao</p>
          <p className="text-lg font-extrabold text-foreground mt-0.5">{totals.ponds.toLocaleString()}</p>
        </div>
        <div className="rounded-lg border border-border bg-card p-2.5">
          <p className="text-xs font-extrabold text-muted-foreground uppercase tracking-wide">Tổng chu kỳ</p>
          <p className="text-lg font-extrabold text-foreground mt-0.5">{totals.cycles.toLocaleString()}</p>
        </div>
        <div className="rounded-lg border border-border bg-card p-2.5">
          <p className="text-xs font-extrabold text-muted-foreground uppercase tracking-wide">Cá ban đầu</p>
          <p className="text-lg font-extrabold text-foreground mt-0.5">{totals.sum_total_fish ? totals.sum_total_fish.toLocaleString() : '—'}</p>
        </div>
        <div className="rounded-lg border border-border bg-card p-2.5">
          <p className="text-xs font-extrabold text-muted-foreground uppercase tracking-wide">Thả thêm</p>
          <p className="text-lg font-extrabold text-foreground mt-0.5">{totals.sum_stocked_added ? totals.sum_stocked_added.toLocaleString() : '—'}</p>
        </div>
        <div className="rounded-lg border border-border bg-card p-2.5">
          <p className="text-xs font-extrabold text-muted-foreground uppercase tracking-wide">{isHarvestedView ? 'Thực thu (kg)' : 'Cá hiện tại'}</p>
          <p className="text-lg font-extrabold text-foreground mt-0.5">
            {isHarvestedView
              ? totals.sum_actual_yield
                ? totals.sum_actual_yield.toLocaleString()
                : '—'
              : totals.sum_current_fish
                ? totals.sum_current_fish.toLocaleString()
                : '—'}
          </p>
        </div>
        <div className="rounded-lg border border-border bg-card p-2.5">
          <p className="text-xs font-extrabold text-muted-foreground uppercase tracking-wide">SL dự kiến (kg)</p>
          <p className="text-lg font-extrabold text-foreground mt-0.5">{totals.sum_expected_yield ? totals.sum_expected_yield.toLocaleString() : '—'}</p>
        </div>
        <div className="rounded-lg border border-border bg-card p-2.5">
          <p className="text-xs font-extrabold text-muted-foreground uppercase tracking-wide">Tổng thức ăn (kg)</p>
          <p className="text-lg font-extrabold text-foreground mt-0.5">{totals.sum_total_feed_used ? totals.sum_total_feed_used.toLocaleString() : '—'}</p>
        </div>
      </div>

      <div className="sm:hidden space-y-3">
        {loading ? (
          Array(4)
            .fill(0)
            .map((_, i) => <div key={i} className="h-32 bg-muted rounded-xl animate-pulse" />)
        ) : rows.length === 0 ? (
          <div className="text-center py-12 text-muted-foreground text-base font-semibold">{emptyListHint}</div>
        ) : (
          rows.map((r) => (
            <PondMobileCard
              key={r.row_id}
              harvestAlertDays={harvestAlertDays}
              pond={{
                code: `${r.pond_code} · ${r.cycle_name}`,
                owner_name: r.owner_name,
                status: r.status,
                area: r.area,
                current_fish: r.current_fish,
                expected_yield: r.expected_yield,
                expected_harvest_date: r.expected_harvest_date,
                harvest_date_estimated: r.expected_harvest_date_estimated,
                withdrawal_end_date: r.withdrawal_end_date,
                fcr: r.fcr,
                agency_code: r.agency_code,
                harvest_done: r.harvest_done,
                actual_yield: r.actual_yield,
                actual_harvest_display_kg: r.actual_harvest_display_kg,
                yield_need_harvest: r.yield_need_harvest,
                fish_harvested: r.fish_harvested,
                fish_remaining: r.fish_remaining,
              }}
              checked={r.cycle_id ? checkedHarvest.has(r.cycle_id) : false}
              onCheck={(e) => toggleHarvestCheck(r.cycle_id, e)}
              onClick={() => (r.cycle_id ? setViewCycleId(r.cycle_id) : setViewPondId(r.pond_id))}
            />
          ))
        )}
      </div>

      <div className="hidden sm:block bg-card rounded-xl border border-border shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-base min-w-[1200px]">
            <thead>
              <tr className="bg-muted/30 border-b border-border">
                <th className="px-4 py-3.5 w-8 whitespace-nowrap" />
                {columnDefs.filter((c) => visibleCols[c.key] && c.key !== 'actions').map((h) => (
                  <th key={h.key} className="text-left px-4 py-3.5 text-base font-extrabold text-muted-foreground uppercase tracking-wide whitespace-nowrap">
                    {h.label}
                  </th>
                ))}
                {visibleCols.actions && (
                  <th className="sticky right-0 bg-muted/30 text-center px-4 py-3.5 text-base font-extrabold text-muted-foreground uppercase tracking-wide whitespace-nowrap border-l border-border shadow-[-2px_0_4px_rgba(0,0,0,0.05)]">
                    THAO TÁC
                  </th>
                )}
              </tr>
            </thead>
            <tbody className="divide-y divide-border/60">
              {loading ? (
                Array(6)
                  .fill(0)
                  .map((_, i) => (
                    <tr key={i}>
                      <td className="px-4 py-3" colSpan={columnDefs.length + 1}>
                        <div className="h-4 bg-muted rounded animate-pulse w-32" />
                      </td>
                    </tr>
                  ))
              ) : rows.length === 0 ? (
                <tr>
                  <td colSpan={columnDefs.length + 1} className="text-center py-12 text-muted-foreground text-base font-semibold">
                    {emptyListHint}
                  </td>
                </tr>
              ) : (
                rows.map((r, idx) => {
                  const prevRow = rows[idx - 1];
                  const isNewGroup = !prevRow || prevRow.pond_code !== r.pond_code;
                  const cycleIsCc = String(r.status ?? '').toUpperCase() === 'CC';
                  const diff = calendarDaysUntilHarvest(r.expected_harvest_date, today);
                  const harvestComplete = isCycleHarvestCompleteForAlerts(r);
                  const isUrgent = !harvestComplete && isHarvestDateOnOrBeforeToday(diff);
                  const isUpcomingHarvest =
                    !harvestComplete && isHarvestDateWithinUpcomingDays(diff, harvestAlertDays);
                  const isOverdue = !harvestComplete && diff !== null && diff < 0;
                  const withdrawalDiff = r.withdrawal_end_date
                    ? calendarDaysUntilHarvest(r.withdrawal_end_date, today)
                    : null;
                  const isWithdrawal =
                    !harvestComplete &&
                    r.withdrawal_end_date &&
                    withdrawalDiff !== null &&
                    withdrawalDiff >= 0;
                  const rowBgClass = isOverdue
                    ? 'bg-red-50/40'
                    : isUrgent
                      ? 'bg-yellow-50/40'
                      : isUpcomingHarvest
                        ? 'bg-amber-50/25'
                        : 'bg-card';

                  return (
                    <tr
                      key={r.row_id}
                      onClick={() => (r.cycle_id ? setViewCycleId(r.cycle_id) : setViewPondId(r.pond_id))}
                      className={`hover:bg-primary/5 cursor-pointer transition-colors ${isNewGroup ? 'border-t-2 border-t-muted/40' : ''} ${isOverdue ? 'bg-red-50/40' : isUrgent ? 'bg-yellow-50/40' : isUpcomingHarvest ? 'bg-amber-50/25' : ''}`}
                    >
                      <td className="px-4 py-3.5 whitespace-nowrap" onClick={(e) => e.stopPropagation()}>
                        {isUrgent && cycleIsCc && r.cycle_id && (
                          <input
                            type="checkbox"
                            checked={checkedHarvest.has(r.cycle_id)}
                            onChange={(e) => toggleHarvestCheck(r.cycle_id, e)}
                            className="w-4 h-4 accent-green-600 cursor-pointer"
                          />
                        )}
                      </td>
                      {visibleCols.agency_code && (
                        <td className="px-4 py-3.5 text-muted-foreground text-sm font-semibold whitespace-nowrap">{r.agency_code || '—'}</td>
                      )}
                      {visibleCols.owner_name && <td className="px-4 py-3.5 text-slate-700 font-semibold whitespace-nowrap">{r.owner_name}</td>}
                      {visibleCols.pond_code && <td className="px-4 py-3.5 font-extrabold text-slate-800 whitespace-nowrap">{r.pond_code}</td>}
                      {visibleCols.cycle_name && <td className="px-4 py-3.5 text-slate-700 font-semibold whitespace-nowrap">{r.cycle_name}</td>}
                      {visibleCols.status && (
                        <td className="px-4 py-3.5 whitespace-nowrap">
                          <PondStatusBadge status={r.status} />
                        </td>
                      )}
                      {visibleCols.stock_date && (
                        <td className="px-4 py-3.5 text-slate-600 text-sm font-semibold whitespace-nowrap">{formatDateDisplay(r.stock_date)}</td>
                      )}
                      {visibleCols.total_fish && (
                        <td className="px-4 py-3.5 text-right font-semibold text-slate-800 whitespace-nowrap">
                          {r.total_fish != null && !Number.isNaN(Number(r.total_fish)) ? Number(r.total_fish).toLocaleString() : '—'}
                        </td>
                      )}
                      {visibleCols.stocked_fish_added && (
                        <td className="px-4 py-3.5 text-right font-semibold text-emerald-800 whitespace-nowrap">
                          {r.stocked_fish_added != null && !Number.isNaN(Number(r.stocked_fish_added))
                            ? Number(r.stocked_fish_added).toLocaleString()
                            : '—'}
                        </td>
                      )}
                      {visibleCols.current_fish && (
                        <td className="px-4 py-3.5 text-right font-semibold text-slate-800 whitespace-nowrap">
                          {r.current_fish != null && !Number.isNaN(Number(r.current_fish)) ? Number(r.current_fish).toLocaleString() : '—'}
                        </td>
                      )}
                      {visibleCols.expected_yield && (
                        <td className="px-4 py-3.5 text-right font-extrabold text-slate-900 whitespace-nowrap">
                          {r.expected_yield != null ? Number(r.expected_yield).toLocaleString() : '—'}
                        </td>
                      )}
                      {defKeys.has('actual_yield') && visibleCols.actual_yield && (
                        <td className="px-4 py-3.5 text-right font-extrabold text-green-800 whitespace-nowrap">
                          {(() => {
                            const v =
                              r.actual_harvest_display_kg != null
                                ? Number(r.actual_harvest_display_kg)
                                : Number(r.actual_yield);
                            return Number.isFinite(v) && v > 0 ? v.toLocaleString() : '—';
                          })()}
                        </td>
                      )}
                      {defKeys.has('yield_need_harvest') && visibleCols.yield_need_harvest && (
                        <td className="px-4 py-3.5 text-right font-extrabold text-amber-900 whitespace-nowrap">
                          {r.yield_need_harvest != null && Number.isFinite(Number(r.yield_need_harvest))
                            ? Number(r.yield_need_harvest).toLocaleString()
                            : '—'}
                        </td>
                      )}
                      {defKeys.has('fish_harvested') && visibleCols.fish_harvested && (
                        <td className="px-4 py-3.5 text-right font-bold text-emerald-900 whitespace-nowrap">
                          {r.fish_harvested != null && !Number.isNaN(Number(r.fish_harvested))
                            ? Number(r.fish_harvested).toLocaleString()
                            : '—'}
                        </td>
                      )}
                      {defKeys.has('fish_remaining') && visibleCols.fish_remaining && (
                        <td className="px-4 py-3.5 text-right font-bold text-amber-950 whitespace-nowrap">
                          {r.fish_remaining != null && !Number.isNaN(Number(r.fish_remaining))
                            ? Number(r.fish_remaining).toLocaleString()
                            : '—'}
                        </td>
                      )}
                      {visibleCols.expected_harvest_date && (
                        <td
                          className={`px-4 py-3.5 text-sm whitespace-nowrap ${
                            isUrgent ? 'font-extrabold text-red-600' : isUpcomingHarvest ? 'font-bold text-amber-800' : 'text-slate-700 font-semibold'
                          }`}
                        >
                          {formatDateDisplay(r.expected_harvest_date)}
                          {r.expected_harvest_date_estimated && (
                            <span className="text-muted-foreground font-normal ml-1">(ước)</span>
                          )}
                          {isOverdue && <span className="text-red-500 ml-1">(QH)</span>}
                        </td>
                      )}
                      {visibleCols.total_feed_used && (
                        <td className="px-4 py-3.5 text-right text-blue-700 font-semibold whitespace-nowrap">
                          {r.total_feed_used > 0 ? Number(r.total_feed_used).toLocaleString() : '—'}
                        </td>
                      )}
                      {visibleCols.fcr && (
                        <td className="px-4 py-3.5 text-center whitespace-nowrap">
                          {(() => {
                            if (r.fcr != null) {
                              return (
                                <span
                                  className={`px-2 py-0.5 rounded text-sm font-bold ${
                                    r.fcr <= 1.3 ? 'bg-green-100 text-green-700' : r.fcr <= 1.6 ? 'bg-yellow-100 text-yellow-700' : 'bg-red-100 text-red-700'
                                  }`}
                                >
                                  {r.fcr}
                                </span>
                              );
                            }
                            if (r.total_feed_used > 0) {
                              const yieldDen =
                                Number(r.fcr_yield_basis) > 0 ? Number(r.fcr_yield_basis) : Number(r.expected_yield) || 0;
                              if (yieldDen <= 0) return '—';
                              const tempFcr = Math.round((r.total_feed_used / yieldDen) * 100) / 100;
                              return (
                                <span className="px-2 py-0.5 rounded text-sm font-bold bg-slate-100 text-slate-600">{tempFcr}</span>
                              );
                            }
                            return '—';
                          })()}
                        </td>
                      )}
                      {visibleCols.alerts && (
                        <td className="px-4 py-3.5">
                          <div className="flex flex-wrap gap-1">
                            {isUrgent && (
                              <span className="text-xs px-2 py-0.5 bg-red-100 text-red-600 rounded-sm font-extrabold tracking-tight">THU</span>
                            )}
                            {isUpcomingHarvest && (
                              <span className="text-xs px-2 py-0.5 bg-amber-100 text-amber-800 rounded-sm font-extrabold tracking-tight">
                                SẮP THU
                              </span>
                            )}
                            {isWithdrawal && (
                              <span className="text-xs px-2 py-0.5 bg-orange-100 text-orange-600 rounded-sm font-extrabold tracking-tight">THUỐC</span>
                            )}
                          </div>
                        </td>
                      )}
                      {visibleCols.actions && (
                        <td
                          className={`sticky right-0 ${rowBgClass} px-4 py-3.5 text-center whitespace-nowrap border-l border-border shadow-[-2px_0_4px_rgba(0,0,0,0.05)]`}
                          onClick={(e) => e.stopPropagation()}
                        >
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground hover:text-foreground">
                                <MoreHorizontal className="w-4 h-4" />
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end" className="w-32">
                              <DropdownMenuItem onClick={() => (r.cycle_id ? setViewCycleId(r.cycle_id) : setViewPondId(r.pond_id))}>
                                <Eye className="w-4 h-4 mr-2" /> Xem
                              </DropdownMenuItem>
                              <DropdownMenuItem
                                onClick={() => {
                                  if (r.cycle_id) {
                                    setEditCycleId(r.cycle_id);
                                  } else {
                                    setSelectedPond({ id: r.pond_id, code: r.pond_code, area: r.area, depth: r.depth, location: r.location });
                                    setShowEditDialog(true);
                                  }
                                }}
                              >
                                <Edit className="w-4 h-4 mr-2" /> Sửa
                              </DropdownMenuItem>
                              <DropdownMenuSeparator />
                              {r.cycle_id ? (
                                <DropdownMenuItem
                                  className="text-red-600 focus:text-red-600"
                                  onClick={() => {
                                    setDeleteCycleId(r.cycle_id);
                                    setDeleteCycleLabel(`${r.pond_code} · ${r.cycle_name}`);
                                  }}
                                >
                                  <Trash2 className="w-4 h-4 mr-2" /> Xoá
                                </DropdownMenuItem>
                              ) : (
                                <DropdownMenuItem
                                  className="text-red-600 focus:text-red-600"
                                  onClick={() => {
                                    setSelectedPond({ id: r.pond_id, code: r.pond_code });
                                    setShowDeleteConfirm(true);
                                  }}
                                >
                                  <Trash2 className="w-4 h-4 mr-2" /> Xoá
                                </DropdownMenuItem>
                              )}
                            </DropdownMenuContent>
                          </DropdownMenu>
                        </td>
                      )}
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>
    </>
  );
}
