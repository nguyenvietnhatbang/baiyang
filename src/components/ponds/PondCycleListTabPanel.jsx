import { useMemo } from 'react';
import { MoreHorizontal, Eye, Edit, Trash2, ClipboardCheck } from 'lucide-react';
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
import { canOfferManualChotThuHoach } from '@/lib/pondCycleHelpers';
import {
  cycleTable,
  cycleColgroupPlan,
  cycleThClass,
  cycleTdClass,
  cycleTdOpts,
} from '@/components/ponds/cycleTableLayout';
import { harvestedTabKgHarvested, harvestedTabKgRemaining } from '@/lib/cycleHarvestCompletion';
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
  cycleHarvestMonth,
  setCycleHarvestMonth,
  cycleHarvestYear,
  setCycleHarvestYear,
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
  canManualCloseCycle = false,
  onManualCloseCycle,
}) {
  const isHarvestedView = variant === 'harvested';
  const emptyListHint = isHarvestedView ? 'Không có chu kỳ đã thu hoạch' : 'Không tìm thấy chu kỳ nào';

  /** Chỉ render ô dữ liệu khi cột có trong columnDefs — tránh lệch với thead (tab Chu kỳ không có cột cá đã thu). */
  const defKeys = useMemo(() => new Set(columnDefs.map((c) => c.key)), [columnDefs]);
  const colPlan = useMemo(
    () => cycleColgroupPlan(columnDefs, visibleCols, { showCheck: true, showActions: Boolean(visibleCols.actions) }),
    [columnDefs, visibleCols]
  );
  const thAlignFor = (key) =>
    ['total_fish', 'stocked_fish_added', 'current_fish', 'expected_yield', 'actual_yield', 'yield_need_harvest', 'fish_harvested', 'fish_remaining', 'total_feed_used', 'fcr'].includes(key)
      ? 'right'
      : 'left';
  const cell = (key, extra = '') => `${cycleTdClass(key, cycleTdOpts(key))}${extra ? ` ${extra}` : ''}`;

  return (
    <>
      {!isHarvestedView && checkedHarvest.size > 0 && (
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 bg-green-50 border border-green-200 rounded-lg px-4 py-3">
          <p className="text-base font-semibold text-green-800">
            Đã chọn <strong className="font-extrabold">{checkedHarvest.size}</strong> chu kỳ có <strong>sản lượng cần phải thu &gt; 0</strong> (kg kế hoạch &gt; thực tế) — chốt để chuyển sang tab Chu kỳ đã thu
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
        harvestMonth={cycleHarvestMonth}
        setHarvestMonth={setCycleHarvestMonth}
        harvestYear={cycleHarvestYear}
        setHarvestYear={setCycleHarvestYear}
        showHarvestMonthPicker
      />

      <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-7 gap-2">
        <div className="rounded-lg border border-border bg-card p-3">
          <p className="text-sm font-extrabold text-muted-foreground uppercase tracking-wide">Tổng ao</p>
          <p className="text-xl font-extrabold text-foreground mt-0.5">{totals.ponds.toLocaleString()}</p>
        </div>
        <div className="rounded-lg border border-border bg-card p-3">
          <p className="text-sm font-extrabold text-muted-foreground uppercase tracking-wide">Tổng chu kỳ</p>
          <p className="text-xl font-extrabold text-foreground mt-0.5">{totals.cycles.toLocaleString()}</p>
        </div>
        <div className="rounded-lg border border-border bg-card p-3">
          <p className="text-sm font-extrabold text-muted-foreground uppercase tracking-wide">Cá ban đầu</p>
          <p className="text-xl font-extrabold text-foreground mt-0.5">{totals.sum_total_fish ? totals.sum_total_fish.toLocaleString() : '—'}</p>
        </div>
        <div className="rounded-lg border border-border bg-card p-3">
          <p className="text-sm font-extrabold text-muted-foreground uppercase tracking-wide">Thả thêm</p>
          <p className="text-xl font-extrabold text-foreground mt-0.5">{totals.sum_stocked_added ? totals.sum_stocked_added.toLocaleString() : '—'}</p>
        </div>
        <div className="rounded-lg border border-border bg-card p-3">
          <p className="text-sm font-extrabold text-muted-foreground uppercase tracking-wide">{isHarvestedView ? 'Sản lượng đã thu (kg)' : 'Cá hiện tại'}</p>
          <p className="text-xl font-extrabold text-foreground mt-0.5">
            {isHarvestedView
              ? totals.sum_actual_yield
                ? totals.sum_actual_yield.toLocaleString()
                : '—'
              : totals.sum_current_fish
                ? totals.sum_current_fish.toLocaleString()
                : '—'}
          </p>
        </div>
        <div className="rounded-lg border border-border bg-card p-3">
          <p className="text-sm font-extrabold text-muted-foreground uppercase tracking-wide">Sản lượng dự kiến (kg)</p>
          <p className="text-xl font-extrabold text-foreground mt-0.5">{totals.sum_expected_yield ? totals.sum_expected_yield.toLocaleString() : '—'}</p>
        </div>
        <div className="rounded-lg border border-border bg-card p-3">
          <p className="text-sm font-extrabold text-muted-foreground uppercase tracking-wide">Tổng thức ăn (kg)</p>
          <p className="text-xl font-extrabold text-foreground mt-0.5">{totals.sum_total_feed_used ? totals.sum_total_feed_used.toLocaleString() : '—'}</p>
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
              harvestedKgColumns={isHarvestedView}
              pond={{
                cycle_id: r.cycle_id,
                code: `${r.pond_code} · ${r.cycle_name}`,
                owner_name: r.owner_name,
                status: r.status,
                harvest_done: r.harvest_done,
                area: r.area,
                current_fish: r.current_fish,
                expected_yield: r.expected_yield,
                expected_harvest_date: isHarvestedView ? r.latest_harvest_date : r.expected_harvest_date,
                harvest_date_estimated: isHarvestedView ? false : r.expected_harvest_date_estimated,
                withdrawal_end_date: r.withdrawal_end_date,
                fcr: r.fcr,
                agency_code: r.agency_code,
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
          <table className={cycleTable.root}>
            <colgroup>
              {colPlan.map((col) => (
                <col key={col.key} style={{ width: `${col.pct}%` }} />
              ))}
            </colgroup>
            <thead>
              <tr className="bg-muted/30 border-b border-border">
                <th className={cycleTable.checkCol} />
                {columnDefs.filter((c) => visibleCols[c.key] && c.key !== 'actions').map((h) => (
                  <th key={h.key} title={h.title || h.label} className={cycleThClass(h.key, thAlignFor(h.key))}>
                    {h.label}
                  </th>
                ))}
                {visibleCols.actions && (
                  <th
                    title="Thao tác"
                    className={`sticky right-0 bg-muted/30 ${cycleTable.th} ${cycleTable.thCenter} ${cycleTable.actionsCol} border-l border-border shadow-[-2px_0_4px_rgba(0,0,0,0.05)]`}
                  >
                    ···
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
                      <td className={cycleTable.checkCol} onClick={(e) => e.stopPropagation()}>
                        {canOfferManualChotThuHoach(r) && (
                          <input
                            type="checkbox"
                            checked={checkedHarvest.has(r.cycle_id)}
                            onChange={(e) => toggleHarvestCheck(r.cycle_id, e)}
                            className="w-4 h-4 accent-green-600 cursor-pointer"
                            title="Chốt chuyển sang Chu kỳ đã thu (khi kg kế hoạch > thực tế)"
                          />
                        )}
                      </td>
                      {visibleCols.agency_code && (
                        <td className={cell('agency_code', 'text-muted-foreground font-semibold')}>{r.agency_code || '—'}</td>
                      )}
                      {visibleCols.owner_name && (
                        <td className={cell('owner_name', 'text-slate-700 font-semibold')} title={r.owner_name || ''}>
                          {r.owner_name || '—'}
                        </td>
                      )}
                      {visibleCols.pond_code && (
                        <td className={cell('pond_code', 'font-bold text-slate-800')}>{r.pond_code}</td>
                      )}
                      {visibleCols.cycle_name && (
                        <td className={cell('cycle_name', 'text-slate-700 font-semibold')} title={r.cycle_name || ''}>
                          {r.cycle_name}
                        </td>
                      )}
                      {visibleCols.status && (
                        <td className={cell('status')}>
                          <PondStatusBadge status={r.status} compact />
                        </td>
                      )}
                      {visibleCols.stock_date && (
                        <td className={cell('stock_date', 'text-slate-600 font-semibold')}>{formatDateDisplay(r.stock_date)}</td>
                      )}
                      {visibleCols.total_fish && (
                        <td className={cell('total_fish', 'font-semibold text-slate-800')}>
                          {r.total_fish != null && !Number.isNaN(Number(r.total_fish)) ? Number(r.total_fish).toLocaleString() : '—'}
                        </td>
                      )}
                      {visibleCols.stocked_fish_added && (
                        <td className={cell('stocked_fish_added', 'font-semibold text-emerald-800')}>
                          {r.stocked_fish_added != null && !Number.isNaN(Number(r.stocked_fish_added))
                            ? Number(r.stocked_fish_added).toLocaleString()
                            : '—'}
                        </td>
                      )}
                      {visibleCols.current_fish && (
                        <td className={cell('current_fish', 'font-semibold text-slate-800')}>
                          {r.current_fish != null && !Number.isNaN(Number(r.current_fish)) ? Number(r.current_fish).toLocaleString() : '—'}
                        </td>
                      )}
                      {visibleCols.expected_yield && (
                        <td className={cell('expected_yield', 'font-bold text-slate-900')}>
                          {r.expected_yield != null ? Number(r.expected_yield).toLocaleString() : '—'}
                        </td>
                      )}
                      {defKeys.has('actual_yield') && visibleCols.actual_yield && (
                        <td className={cell('actual_yield', 'font-bold text-green-800')}>
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
                        <td className={cell('yield_need_harvest', 'font-bold text-amber-900')}>
                          {r.yield_need_harvest != null && Number.isFinite(Number(r.yield_need_harvest))
                            ? Number(r.yield_need_harvest).toLocaleString()
                            : '—'}
                        </td>
                      )}
                      {defKeys.has('fish_harvested') && visibleCols.fish_harvested && (
                        <td className={cell('fish_harvested', 'font-bold text-emerald-900')}>
                          {(() => {
                            const v = isHarvestedView ? harvestedTabKgHarvested(r) : r.fish_harvested;
                            return v != null && !Number.isNaN(Number(v)) ? Number(v).toLocaleString() : '—';
                          })()}
                        </td>
                      )}
                      {defKeys.has('fish_remaining') && visibleCols.fish_remaining && (
                        <td className={cell('fish_remaining', 'font-bold text-amber-950')}>
                          {(() => {
                            const v = isHarvestedView ? harvestedTabKgRemaining(r) : r.fish_remaining;
                            return v != null && !Number.isNaN(Number(v)) ? Number(v).toLocaleString() : '—';
                          })()}
                        </td>
                      )}
                      {visibleCols.expected_harvest_date && (
                        <td
                          className={`${cell('expected_harvest_date')} ${
                            isHarvestedView
                              ? 'text-slate-700 font-semibold'
                              : isUrgent
                                ? 'font-bold text-red-600'
                                : isUpcomingHarvest
                                  ? 'font-semibold text-amber-800'
                                  : 'text-slate-700 font-semibold'
                          }`}
                        >
                          {formatDateDisplay(isHarvestedView ? r.latest_harvest_date : r.expected_harvest_date)}
                          {!isHarvestedView && r.expected_harvest_date_estimated && (
                            <span className="text-muted-foreground font-normal ml-1">(ước)</span>
                          )}
                          {!isHarvestedView && isOverdue && <span className="text-red-500 ml-1">(QH)</span>}
                        </td>
                      )}
                      {visibleCols.total_feed_used && (
                        <td className={cell('total_feed_used', 'text-blue-700 font-semibold')}>
                          {r.total_feed_used > 0 ? Number(r.total_feed_used).toLocaleString() : '—'}
                        </td>
                      )}
                      {visibleCols.fcr && (
                        <td className={cell('fcr', 'text-center')}>
                          {(() => {
                            if (r.fcr != null) {
                              return (
                                <span
                                  className={`px-1.5 py-0.5 rounded text-xs font-bold tabular-nums ${
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
                                <span className="px-1.5 py-0.5 rounded text-xs font-bold tabular-nums bg-slate-100 text-slate-600">{tempFcr}</span>
                              );
                            }
                            return '—';
                          })()}
                        </td>
                      )}
                      {visibleCols.alerts && (
                        <td className={cell('alerts')}>
                          <div className="flex flex-wrap gap-0.5">
                            {isUrgent && (
                              <span className="text-[10px] px-1 py-0.5 bg-red-100 text-red-600 rounded-sm font-bold">THU</span>
                            )}
                            {isUpcomingHarvest && (
                              <span className="text-[10px] px-1 py-0.5 bg-amber-100 text-amber-800 rounded-sm font-bold">
                                SẮP
                              </span>
                            )}
                            {isWithdrawal && (
                              <span className="text-[10px] px-1 py-0.5 bg-orange-100 text-orange-600 rounded-sm font-bold">THUỐC</span>
                            )}
                          </div>
                        </td>
                      )}
                      {visibleCols.actions && (
                        <td
                          className={`sticky right-0 ${rowBgClass} ${cycleTable.actionsCol} text-center border-l border-border shadow-[-2px_0_4px_rgba(0,0,0,0.05)]`}
                          onClick={(e) => e.stopPropagation()}
                        >
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button variant="ghost" size="icon" className="h-7 w-7 text-muted-foreground hover:text-foreground">
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
                              {canOfferManualChotThuHoach(r) &&
                                canManualCloseCycle &&
                                typeof onManualCloseCycle === 'function' && (
                                  <DropdownMenuItem
                                    onClick={() =>
                                      onManualCloseCycle(r.cycle_id, `${r.pond_code} · ${r.cycle_name}`)
                                    }
                                  >
                                    <ClipboardCheck className="w-4 h-4 mr-2" /> Chốt kết thúc chu kỳ…
                                  </DropdownMenuItem>
                                )}
                              <DropdownMenuSeparator />
                              {r.cycle_id ? (
                                <DropdownMenuItem
                                  className="text-red-600 focus:text-red-600"
                                  onClick={() => {
                                    setDeleteCycleId(r.cycle_id);
                                    setDeleteCycleLabel(`${r.pond_code} · ${r.cycle_name}`);
                                  }}
                                >
                                  <Trash2 className="w-4 h-4 mr-2" /> Xóa
                                </DropdownMenuItem>
                              ) : (
                                <DropdownMenuItem
                                  className="text-red-600 focus:text-red-600"
                                  onClick={() => {
                                    setSelectedPond({ id: r.pond_id, code: r.pond_code });
                                    setShowDeleteConfirm(true);
                                  }}
                                >
                                  <Trash2 className="w-4 h-4 mr-2" /> Xóa
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
