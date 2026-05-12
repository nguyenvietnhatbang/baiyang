import { useEffect, useMemo, useState, useRef } from 'react';
import { Search, ChevronsUpDown, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { cn } from '@/lib/utils';

/**
 * Lọc đa chọn: gõ tìm + checkbox. Dùng panel absolute trong ô relative (không Popover/portal)
 * để menu luôn nằm sát nút, tránh lệch trái trên layout có sidebar / scroll.
 */
export function SearchableMultiFilterPopover({
  label,
  options,
  selectedKeys,
  setSelectedKeys,
  buttonClassName,
}) {
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState('');
  const rootRef = useRef(null);

  useEffect(() => {
    if (!open) setQ('');
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const onPointerDown = (e) => {
      const root = rootRef.current;
      if (!root || root.contains(e.target)) return;
      setOpen(false);
    };
    document.addEventListener('pointerdown', onPointerDown);
    return () => document.removeEventListener('pointerdown', onPointerDown);
  }, [open]);

  const filtered = useMemo(() => {
    const s = q.trim().toLowerCase();
    if (!s) return options;
    return options.filter(
      (o) =>
        String(o.label).toLowerCase().includes(s) ||
        String(o.key).toLowerCase().includes(s)
    );
  }, [options, q]);

  const summary =
    selectedKeys.size === 0 ? `${label}: Tất cả` : `${label}: ${selectedKeys.size} đã chọn`;

  const toggle = (key) => {
    setSelectedKeys((prev) => {
      const next = new Set(prev);
      const k = String(key);
      next.has(k) ? next.delete(k) : next.add(k);
      return next;
    });
  };

  return (
    <div ref={rootRef} className={cn('relative shrink-0 min-w-0', buttonClassName)}>
      <Button
        type="button"
        variant="outline"
        aria-expanded={open}
        aria-haspopup="dialog"
        onClick={() => setOpen((v) => !v)}
        className="w-full min-w-0 justify-between gap-1 min-h-10 h-auto py-2 text-base font-semibold"
      >
        <span className="truncate text-left">{summary}</span>
        <ChevronsUpDown className="h-5 w-5 shrink-0 opacity-50" aria-hidden />
      </Button>
      {open && (
        <div
          className="absolute left-0 top-[calc(100%+4px)] z-[200] flex w-full min-w-[12rem] flex-col overflow-hidden rounded-lg border border-border bg-popover text-popover-foreground shadow-lg ring-1 ring-foreground/10"
          role="dialog"
        >
          <div className="flex flex-col gap-1 border-b border-border p-2">
            <Input
              autoFocus
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder={`Tìm ${label.toLowerCase()}…`}
              className="h-10 text-base font-semibold"
              onKeyDown={(e) => e.stopPropagation()}
            />
          </div>
          <div className="max-h-64 overflow-y-auto p-1">
            {filtered.length === 0 ? (
              <p className="px-2 py-3 text-sm font-semibold text-muted-foreground text-center">Không có mục phù hợp</p>
            ) : (
              filtered.map((opt) => {
                const checked = selectedKeys.has(String(opt.key));
                return (
                  <button
                    key={String(opt.key)}
                    type="button"
                    className="flex w-full items-center gap-2 rounded-md px-2 py-2 text-left text-base font-semibold hover:bg-accent"
                    onClick={() => toggle(opt.key)}
                  >
                    <span
                      className={cn(
                        'flex h-4 w-4 shrink-0 items-center justify-center rounded border border-input',
                        checked && 'border-primary bg-primary text-primary-foreground'
                      )}
                      aria-hidden
                    >
                      {checked ? '✓' : ''}
                    </span>
                    <span className="min-w-0 flex-1 truncate">{opt.label}</span>
                  </button>
                );
              })
            )}
          </div>
          <div className="border-t border-border p-1">
            <Button type="button" variant="ghost" size="sm" className="h-10 w-full text-sm font-bold" onClick={() => setSelectedKeys(new Set())}>
              Bỏ chọn
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}

export function CycleDateRangeFilterBar({
  dateField,
  setDateField,
  dateFrom,
  setDateFrom,
  dateTo,
  setDateTo,
}) {
  const clearDates = () => {
    setDateFrom('');
    setDateTo('');
  };
  const hasRange = Boolean((dateFrom || '').trim() || (dateTo || '').trim());

  return (
    <div className="flex flex-wrap items-end gap-2">
      <div className="flex flex-col gap-0.5 min-w-[10.5rem]">
        <label className="text-xs font-bold text-muted-foreground uppercase tracking-wide">Lọc theo ngày</label>
        <select
          className="h-10 rounded-md border border-input bg-background px-2 text-sm font-semibold"
          value={dateField}
          onChange={(e) => setDateField(e.target.value === 'expected_harvest' ? 'expected_harvest' : 'stock')}
        >
          <option value="stock">Ngày thả</option>
          <option value="expected_harvest">Thu hoạch dự kiến</option>
        </select>
      </div>
      <div className="flex flex-col gap-0.5">
        <label className="text-xs font-bold text-muted-foreground uppercase tracking-wide">Từ ngày</label>
        <Input type="date" className="h-10 w-[11rem] text-sm font-semibold" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} />
      </div>
      <div className="flex flex-col gap-0.5">
        <label className="text-xs font-bold text-muted-foreground uppercase tracking-wide">Đến ngày</label>
        <Input type="date" className="h-10 w-[11rem] text-sm font-semibold" value={dateTo} onChange={(e) => setDateTo(e.target.value)} />
      </div>
      {hasRange && (
        <Button type="button" variant="outline" size="sm" className="h-10 gap-1 text-sm font-bold shrink-0" onClick={clearDates}>
          <X className="h-3.5 w-3.5" />
          Xóa ngày
        </Button>
      )}
    </div>
  );
}

/**
 * Thanh tìm kiếm + lọc trạng thái / đại lý / chủ hộ (popover gõ tìm + tick) + khoảng ngày.
 */
export default function PondTableFilterControls({
  search,
  setSearch,
  searchPlaceholder = 'Tìm…',
  statusFilterItems,
  statusFilters,
  setStatusFilters,
  agencyFilterItems,
  agencyFilters,
  setAgencyFilters,
  householdFilterItems,
  householdFilters,
  setHouseholdFilters,
  showDateRange = false,
  dateField,
  setDateField,
  dateFrom,
  setDateFrom,
  dateTo,
  setDateTo,
}) {
  const statusOptions = useMemo(
    () => statusFilterItems.map((it) => ({ key: it.value, label: it.label })),
    [statusFilterItems]
  );
  const agencyOptions = useMemo(
    () => (agencyFilterItems || []).map((a) => ({ key: String(a), label: String(a) })),
    [agencyFilterItems]
  );
  const householdOptions = useMemo(
    () =>
      (householdFilterItems || []).map((h) => ({
        key: String(h.id),
        label: `${h.agency ? `${h.agency} — ` : ''}${h.name}`,
      })),
    [householdFilterItems]
  );

  return (
    <div className="flex w-full min-w-0 flex-col gap-2 sm:gap-3">
      <div className="flex w-full min-w-0 flex-wrap gap-2 sm:gap-3 items-center">
        <div className="relative min-w-[12rem] flex-1 basis-[min(100%,24rem)]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground pointer-events-none" />
          <Input placeholder={searchPlaceholder} value={search} onChange={(e) => setSearch(e.target.value)} className="pl-10 h-11 text-base font-semibold" />
        </div>

        <SearchableMultiFilterPopover
          label="Trạng thái"
          options={statusOptions}
          selectedKeys={statusFilters}
          setSelectedKeys={setStatusFilters}
          buttonClassName="w-44"
        />

        <SearchableMultiFilterPopover
          label="Đại lý"
          options={agencyOptions}
          selectedKeys={agencyFilters}
          setSelectedKeys={setAgencyFilters}
          buttonClassName="w-44"
        />

        <SearchableMultiFilterPopover
          label="Chủ hộ"
          options={householdOptions}
          selectedKeys={householdFilters}
          setSelectedKeys={setHouseholdFilters}
          buttonClassName="w-52 min-w-[12rem]"
        />
      </div>

      {showDateRange && setDateField && (
        <CycleDateRangeFilterBar
          dateField={dateField}
          setDateField={setDateField}
          dateFrom={dateFrom}
          setDateFrom={setDateFrom}
          dateTo={dateTo}
          setDateTo={setDateTo}
        />
      )}
    </div>
  );
}
