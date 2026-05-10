import { Search, ChevronsUpDown, MoreHorizontal, Eye, Edit, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import PondStatusBadge from '@/components/ponds/PondStatusBadge';
import PondMobileCard from '@/components/ponds/PondMobileCard';
import { differenceInDays, parseISO } from 'date-fns';
import { formatDateDisplay } from '@/lib/dateFormat';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
  DropdownMenuCheckboxItem,
  DropdownMenuLabel,
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
  checkedHarvest,
  setCheckedHarvest,
  toggleHarvestCheck,
  handleConfirmHarvest,
  confirming,
  harvestAlertDays,
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
}) {
  const isHarvestedView = variant === 'harvested';
  const emptyListHint = isHarvestedView ? 'Không có chu kỳ đã thu hoạch' : 'Không tìm thấy chu kỳ nào';

  return (
    <>
      {!isHarvestedView && checkedHarvest.size > 0 && (
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 bg-green-50 border border-green-200 rounded-lg px-4 py-3">
          <p className="text-sm text-green-700 font-medium">
            Đã chọn <strong>{checkedHarvest.size}</strong> chu kỳ để chốt thu hoạch
          </p>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={() => setCheckedHarvest(new Set())}>
              Bỏ chọn
            </Button>
            <Button size="sm" className="bg-green-600 hover:bg-green-700 text-white" onClick={handleConfirmHarvest} disabled={confirming}>
              {confirming ? 'Đang xử lý...' : '✅ Xác nhận đã thu'}
            </Button>
          </div>
        </div>
      )}

      <div className="flex w-full min-w-0 flex-wrap gap-2 sm:gap-3 items-center">
        <div className="relative min-w-[12rem] flex-1 basis-[min(100%,24rem)]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input placeholder="Tìm mã ao, tên chủ hộ, tên chu kỳ..." value={search} onChange={(e) => setSearch(e.target.value)} className="pl-9" />
        </div>

        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="outline" className="w-44 justify-between">
              {statusFilters.size === 0 ? 'Trạng thái: Tất cả' : `Trạng thái: ${[...statusFilters].join(', ')}`}
              <ChevronsUpDown className="w-4 h-4 opacity-50" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="start" className="w-56">
            <DropdownMenuLabel>Trạng thái</DropdownMenuLabel>
            {statusFilterItems.map((it) => (
              <DropdownMenuCheckboxItem
                key={it.value}
                checked={statusFilters.has(it.value)}
                onCheckedChange={() =>
                  setStatusFilters((prev) => {
                    const next = new Set(prev);
                    next.has(it.value) ? next.delete(it.value) : next.add(it.value);
                    return next;
                  })
                }
              >
                {it.label}
              </DropdownMenuCheckboxItem>
            ))}
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={() => setStatusFilters(new Set())}>Bỏ chọn</DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>

        {agencyFilterItems.length > 0 && (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" className="w-44 justify-between">
                {agencyFilters.size === 0 ? 'Đại lý: Tất cả' : `Đại lý: ${agencyFilters.size} đã chọn`}
                <ChevronsUpDown className="w-4 h-4 opacity-50" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="start" className="w-56">
              <DropdownMenuLabel>Đại lý</DropdownMenuLabel>
              {agencyFilterItems.map((a) => (
                <DropdownMenuCheckboxItem
                  key={a}
                  checked={agencyFilters.has(a)}
                  onCheckedChange={() =>
                    setAgencyFilters((prev) => {
                      const next = new Set(prev);
                      next.has(a) ? next.delete(a) : next.add(a);
                      return next;
                    })
                  }
                >
                  {a}
                </DropdownMenuCheckboxItem>
              ))}
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={() => setAgencyFilters(new Set())}>Bỏ chọn</DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        )}

        {householdFilterItems.length > 0 && (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" className="w-52 justify-between">
                {householdFilters.size === 0 ? 'Chủ hộ: Tất cả' : `Chủ hộ: ${householdFilters.size} đã chọn`}
                <ChevronsUpDown className="w-4 h-4 opacity-50" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="start" className="w-[22rem] max-h-80 overflow-auto">
              <DropdownMenuLabel>Chủ hộ</DropdownMenuLabel>
              {householdFilterItems.map((h) => (
                <DropdownMenuCheckboxItem
                  key={h.id}
                  checked={householdFilters.has(String(h.id))}
                  onCheckedChange={() =>
                    setHouseholdFilters((prev) => {
                      const next = new Set(prev);
                      const id = String(h.id);
                      next.has(id) ? next.delete(id) : next.add(id);
                      return next;
                    })
                  }
                >
                  {h.agency ? `${h.agency} — ` : ''}
                  {h.name}
                </DropdownMenuCheckboxItem>
              ))}
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={() => setHouseholdFilters(new Set())}>Bỏ chọn</DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        )}
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-7 gap-2">
        <div className="rounded-lg border border-border bg-card p-2">
          <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-wide">Tổng ao</p>
          <p className="text-base font-extrabold text-foreground mt-0.5">{totals.ponds.toLocaleString()}</p>
        </div>
        <div className="rounded-lg border border-border bg-card p-2">
          <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-wide">Tổng chu kỳ</p>
          <p className="text-base font-extrabold text-foreground mt-0.5">{totals.cycles.toLocaleString()}</p>
        </div>
        <div className="rounded-lg border border-border bg-card p-2">
          <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-wide">Cá ban đầu</p>
          <p className="text-base font-extrabold text-foreground mt-0.5">{totals.sum_total_fish ? totals.sum_total_fish.toLocaleString() : '—'}</p>
        </div>
        <div className="rounded-lg border border-border bg-card p-2">
          <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-wide">Thả thêm</p>
          <p className="text-base font-extrabold text-foreground mt-0.5">{totals.sum_stocked_added ? totals.sum_stocked_added.toLocaleString() : '—'}</p>
        </div>
        <div className="rounded-lg border border-border bg-card p-2">
          <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-wide">{isHarvestedView ? 'Thực thu (kg)' : 'Cá hiện tại'}</p>
          <p className="text-base font-extrabold text-foreground mt-0.5">
            {isHarvestedView
              ? totals.sum_actual_yield
                ? totals.sum_actual_yield.toLocaleString()
                : '—'
              : totals.sum_current_fish
                ? totals.sum_current_fish.toLocaleString()
                : '—'}
          </p>
        </div>
        <div className="rounded-lg border border-border bg-card p-2">
          <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-wide">SL dự kiến (kg)</p>
          <p className="text-base font-extrabold text-foreground mt-0.5">{totals.sum_expected_yield ? totals.sum_expected_yield.toLocaleString() : '—'}</p>
        </div>
        <div className="rounded-lg border border-border bg-card p-2">
          <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-wide">Tổng thức ăn (kg)</p>
          <p className="text-base font-extrabold text-foreground mt-0.5">{totals.sum_total_feed_used ? totals.sum_total_feed_used.toLocaleString() : '—'}</p>
        </div>
      </div>

      <div className="sm:hidden space-y-3">
        {loading ? (
          Array(4)
            .fill(0)
            .map((_, i) => <div key={i} className="h-32 bg-muted rounded-xl animate-pulse" />)
        ) : rows.length === 0 ? (
          <div className="text-center py-12 text-muted-foreground text-sm">{emptyListHint}</div>
        ) : (
          rows.map((r) => (
            <PondMobileCard
              key={r.row_id}
              pond={{
                code: `${r.pond_code} · ${r.cycle_name}`,
                owner_name: r.owner_name,
                status: r.status,
                area: r.area,
                current_fish: r.current_fish,
                expected_yield: r.expected_yield,
                expected_harvest_date: r.expected_harvest_date,
                withdrawal_end_date: r.withdrawal_end_date,
                fcr: r.fcr,
                agency_code: r.agency_code,
                harvest_done: r.harvest_done,
                actual_yield: r.actual_yield,
              }}
              checked={r.cycle_id ? checkedHarvest.has(r.cycle_id) : false}
              onCheck={(e) => toggleHarvestCheck(r.cycle_id, e)}
              onClick={() => (r.cycle_id ? setViewCycleId(r.cycle_id) : setViewPondId(r.pond_id))}
              harvestAlertDays={harvestAlertDays}
            />
          ))
        )}
      </div>

      <div className="hidden sm:block bg-card rounded-xl border border-border shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm min-w-[1000px]">
            <thead>
              <tr className="bg-muted/30 border-b border-border">
                <th className="px-4 py-3 w-8 whitespace-nowrap" />
                {columnDefs.filter((c) => visibleCols[c.key] && c.key !== 'actions').map((h) => (
                  <th key={h.key} className="text-left px-4 py-3 text-[11px] font-bold text-muted-foreground uppercase tracking-wider whitespace-nowrap">
                    {h.label}
                  </th>
                ))}
                {visibleCols.actions && (
                  <th className="sticky right-0 bg-muted/30 text-center px-4 py-3 text-[11px] font-bold text-muted-foreground uppercase tracking-wider whitespace-nowrap border-l border-border shadow-[-2px_0_4px_rgba(0,0,0,0.05)]">
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
                  <td colSpan={columnDefs.length + 1} className="text-center py-12 text-muted-foreground">
                    {emptyListHint}
                  </td>
                </tr>
              ) : (
                rows.map((r, idx) => {
                  const prevRow = rows[idx - 1];
                  const isNewGroup = !prevRow || prevRow.pond_code !== r.pond_code;
                  const diff = r.expected_harvest_date ? differenceInDays(parseISO(r.expected_harvest_date), today) : null;
                  const isHarvested = r.harvest_done === true || (Number(r.actual_yield) || 0) > 0;
                  const isUrgent = !isHarvested && diff !== null && diff <= harvestAlertDays;
                  const isOverdue = diff !== null && diff < 0;
                  const isWithdrawal = !isHarvested && r.withdrawal_end_date && differenceInDays(parseISO(r.withdrawal_end_date), today) >= 0;
                  const rowBgClass = isOverdue ? 'bg-red-50/40' : isUrgent ? 'bg-yellow-50/40' : 'bg-card';

                  return (
                    <tr
                      key={r.row_id}
                      onClick={() => (r.cycle_id ? setViewCycleId(r.cycle_id) : setViewPondId(r.pond_id))}
                      className={`hover:bg-primary/5 cursor-pointer transition-colors ${isNewGroup ? 'border-t-2 border-t-muted/40' : ''} ${isOverdue ? 'bg-red-50/40' : isUrgent ? 'bg-yellow-50/40' : ''}`}
                    >
                      <td className="px-4 py-3 whitespace-nowrap" onClick={(e) => e.stopPropagation()}>
                        {isUrgent && r.status === 'CC' && r.cycle_id && (
                          <input
                            type="checkbox"
                            checked={checkedHarvest.has(r.cycle_id)}
                            onChange={(e) => toggleHarvestCheck(r.cycle_id, e)}
                            className="w-4 h-4 accent-green-600 cursor-pointer"
                          />
                        )}
                      </td>
                      {visibleCols.pond_code && <td className="px-4 py-3 font-bold text-slate-700 whitespace-nowrap">{r.pond_code}</td>}
                      {visibleCols.cycle_name && <td className="px-4 py-3 text-slate-600 font-medium whitespace-nowrap">{r.cycle_name}</td>}
                      {visibleCols.owner_name && <td className="px-4 py-3 text-slate-600 whitespace-nowrap">{r.owner_name}</td>}
                      {visibleCols.agency_code && <td className="px-4 py-3 text-muted-foreground text-xs whitespace-nowrap">{r.agency_code || '—'}</td>}
                      {visibleCols.status && (
                        <td className="px-4 py-3 whitespace-nowrap">
                          <PondStatusBadge status={r.status} />
                        </td>
                      )}
                      {visibleCols.stock_date && (
                        <td className="px-4 py-3 text-slate-500 text-xs whitespace-nowrap">{formatDateDisplay(r.stock_date)}</td>
                      )}
                      {visibleCols.total_fish && (
                        <td className="px-4 py-3 text-right font-medium text-slate-700 whitespace-nowrap">
                          {r.total_fish != null && !Number.isNaN(Number(r.total_fish)) ? Number(r.total_fish).toLocaleString() : '—'}
                        </td>
                      )}
                      {visibleCols.stocked_fish_added && (
                        <td className="px-4 py-3 text-right font-medium text-emerald-700 whitespace-nowrap">
                          {r.stocked_fish_added != null && !Number.isNaN(Number(r.stocked_fish_added))
                            ? Number(r.stocked_fish_added).toLocaleString()
                            : '—'}
                        </td>
                      )}
                      {visibleCols.current_fish && (
                        <td className="px-4 py-3 text-right font-medium text-slate-700 whitespace-nowrap">
                          {r.current_fish != null && !Number.isNaN(Number(r.current_fish)) ? Number(r.current_fish).toLocaleString() : '—'}
                        </td>
                      )}
                      {visibleCols.expected_yield && (
                        <td className="px-4 py-3 text-right font-bold text-slate-800 whitespace-nowrap">
                          {r.expected_yield != null ? Number(r.expected_yield).toLocaleString() : '—'}
                        </td>
                      )}
                      {visibleCols.expected_harvest_date && (
                        <td className={`px-4 py-3 text-xs whitespace-nowrap ${isUrgent ? 'font-bold text-red-600' : 'text-slate-600'}`}>
                          {formatDateDisplay(r.expected_harvest_date)}
                          {isOverdue && <span className="text-red-500 ml-1">(QH)</span>}
                        </td>
                      )}
                      {visibleCols.total_feed_used && (
                        <td className="px-4 py-3 text-right text-blue-600 font-medium whitespace-nowrap">
                          {r.total_feed_used > 0 ? Number(r.total_feed_used).toLocaleString() : '—'}
                        </td>
                      )}
                      {visibleCols.fcr && (
                        <td className="px-4 py-3 text-center whitespace-nowrap">
                          {(() => {
                            if (r.fcr != null) {
                              return (
                                <span
                                  className={`px-1.5 py-0.5 rounded text-xs font-semibold ${
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
                                <span className="px-1.5 py-0.5 rounded text-xs font-semibold bg-slate-100 text-slate-500">{tempFcr}</span>
                              );
                            }
                            return '—';
                          })()}
                        </td>
                      )}
                      {visibleCols.alerts && (
                        <td className="px-4 py-3">
                          <div className="flex gap-1">
                            {isUrgent && (
                              <span className="text-[10px] px-1.5 py-0.5 bg-red-100 text-red-600 rounded-sm font-bold tracking-tight">THU</span>
                            )}
                            {isWithdrawal && (
                              <span className="text-[10px] px-1.5 py-0.5 bg-orange-100 text-orange-600 rounded-sm font-bold tracking-tight">THUỐC</span>
                            )}
                          </div>
                        </td>
                      )}
                      {visibleCols.actions && (
                        <td
                          className={`sticky right-0 ${rowBgClass} px-4 py-3 text-center whitespace-nowrap border-l border-border shadow-[-2px_0_4px_rgba(0,0,0,0.05)]`}
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
