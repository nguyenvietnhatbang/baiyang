import { useState, useEffect, useMemo, useRef } from 'react';
import { useSearchParams } from 'react-router-dom';
import { base44 } from '@/api/base44Client';
import { Plus, Search, Settings2, ChevronsUpDown } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import PondStatusBadge from '@/components/ponds/PondStatusBadge';
import QRBatchDownload from '@/components/ponds/QRBatchDownload';
import PondMobileCard from '@/components/ponds/PondMobileCard';
import { differenceInDays, parseISO } from 'date-fns';
import { useAuth } from '@/lib/AuthContext';
import { MoreHorizontal, Eye, Edit, Trash2, AlertCircle } from 'lucide-react';
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
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { getWaterThresholdDefaults } from '@/lib/appSettingsHelpers';
import { formatSupabaseError } from '@/lib/supabaseErrors';
import { pondQrPayload } from '@/lib/fieldAuthHelpers';
import { plannedHarvestDateForDisplay, plannedYieldForDisplay, plannedYieldAdjustedForTable } from '@/lib/planReportHelpers';
import { calculateCurrentYield } from '@/lib/calculateYield';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { HouseholdsPanel } from '@/components/households/HouseholdsPanel';
import PondViewDialog from '@/components/ponds/PondViewDialog';
import CycleViewDialog from '@/components/ponds/CycleViewDialog';
import CycleEditDialog from '@/components/ponds/CycleEditDialog';
import PondCycleListTabPanel from '@/components/ponds/PondCycleListTabPanel';

function SearchableSelect({ label, value, onChange, options, placeholder = 'Chọn...', disabled }) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState('');
  const rootRef = useRef(null);

  useEffect(() => {
    if (!open) setSearch('');
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const onPointerDown = (e) => {
      const root = rootRef.current;
      if (!root) return;
      if (!root.contains(e.target)) setOpen(false);
    };
    document.addEventListener('pointerdown', onPointerDown);
    return () => document.removeEventListener('pointerdown', onPointerDown);
  }, [open]);

  const q = search.trim().toLowerCase();
  const filtered = useMemo(() => {
    if (!q) return options;
    return options.filter((o) => String(o.label || '').toLowerCase().includes(q));
  }, [options, q]);

  const cur = options.find((o) => String(o.value) === String(value)) || null;

  return (
    <div ref={rootRef} className="relative">
      <Label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">{label}</Label>
      <Button
        type="button"
        variant="outline"
        disabled={disabled}
        onClick={() => setOpen((v) => !v)}
        className={`mt-1 h-9 w-full justify-between px-2 font-normal text-sm ${!cur ? 'text-muted-foreground' : ''}`}
      >
        <span className="truncate text-left">{cur?.label || placeholder}</span>
        <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" aria-hidden />
      </Button>
      {open && !disabled && (
        <div className="absolute left-0 top-[calc(100%+4px)] z-50 w-full min-w-[12rem] rounded-lg border border-border bg-popover shadow-md">
          <div className="p-2 border-b border-border">
            <Input autoFocus value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Tìm..." className="h-8 text-sm" />
          </div>
          <div className="max-h-64 overflow-y-auto p-1">
            {filtered.length === 0 ? (
              <div className="px-2 py-2 text-xs text-muted-foreground">Không có kết quả</div>
            ) : (
              filtered.map((o) => (
                <button
                  key={String(o.value)}
                  type="button"
                  className={`flex w-full items-center rounded-md px-2 py-1.5 text-left text-sm hover:bg-accent hover:text-accent-foreground ${
                    String(o.value) === String(value) ? 'bg-accent/60' : ''
                  }`}
                  onClick={() => {
                    onChange(o.value);
                    setOpen(false);
                  }}
                >
                  {o.label}
                </button>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
}

const POND_STATUS_FILTER_ITEMS = [
  { value: 'all', label: 'Tất cả trạng thái' },
  { value: 'CC', label: 'CC - Có cá' },
  { value: 'CT', label: 'CT - Chưa thả' },
];

/** Thứ tự bảng Chu kỳ (khớp màn hình quản lý); cột Thao tác luôn cuối (render sticky riêng). */
const CYCLE_COLUMNS_BASE = [
  { key: 'agency_code', label: 'ĐẠI LÝ' },
  { key: 'owner_name', label: 'CHỦ HỘ' },
  { key: 'pond_code', label: 'MÃ AO' },
  { key: 'cycle_name', label: 'CHU KỲ' },
  { key: 'status', label: 'TRẠNG THÁI' },
  { key: 'stock_date', label: 'NGÀY THẢ' },
  { key: 'total_fish', label: 'SỐ CÁ BAN ĐẦU' },
  { key: 'stocked_fish_added', label: 'SỐ CÁ THẢ THÊM' },
  { key: 'current_fish', label: 'SỐ CÁ HIỆN TẠI' },
  { key: 'expected_yield', label: 'SẢN LƯỢNG DỰ KIẾN' },
  { key: 'actual_yield', label: 'SẢN LƯỢNG ĐÃ THU' },
  { key: 'yield_need_harvest', label: 'SẢN LƯỢNG CẦN PHẢI THU' },
  { key: 'expected_harvest_date', label: 'THU HOẠCH DỰ KIẾN' },
  { key: 'total_feed_used', label: 'TỔNG THỨC ĂN' },
  { key: 'fcr', label: 'FCR' },
  { key: 'alerts', label: 'CẢNH BÁO' },
  { key: 'actions', label: '' },
];

const HARVESTED_TAB_FISH_COLUMNS = [
  { key: 'fish_harvested', label: 'SỐ CÁ ĐÃ THU' },
  { key: 'fish_remaining', label: 'SỐ CÁ CÒN PHẢI THU' },
];

function insertColumnsBeforeKey(base, beforeKey, toInsert) {
  const idx = base.findIndex((c) => c.key === beforeKey);
  if (idx < 0) return [...base, ...toInsert];
  return [...base.slice(0, idx), ...toInsert, ...base.slice(idx)];
}

function cycleColumnDefsForMainTab(mainTab) {
  if (mainTab === 'cyclesHarvested') {
    return insertColumnsBeforeKey(CYCLE_COLUMNS_BASE, 'expected_harvest_date', HARVESTED_TAB_FISH_COLUMNS);
  }
  return CYCLE_COLUMNS_BASE;
}

const DEFAULT_VISIBLE_COLUMNS = {
  pond_code: true,
  cycle_name: true,
  owner_name: true,
  agency_code: true,
  status: true,
  stock_date: true,
  total_fish: true,
  stocked_fish_added: true,
  current_fish: true,
  expected_yield: true,
  expected_harvest_date: true,
  total_feed_used: true,
  fcr: true,
  alerts: true,
  actions: true,
  actual_yield: true,
  yield_need_harvest: true,
  fish_harvested: true,
  fish_remaining: true,
};

/** Tổng con cá trên phiếu thu; nếu không có phiếu thì ước từ tồn (ban đầu + thả thêm − hiện tại) khi đã chốt thu. */
function computeFishHarvestCounts(row, ticketSumByCycleId) {
  const basis = (Number(row.total_fish) || 0) + (Number(row.stocked_fish_added) || 0);
  const tid = row.cycle_id != null ? String(row.cycle_id) : '';
  const ticketSum = tid ? Number(ticketSumByCycleId.get(tid)) || 0 : 0;
  const curRaw = row.current_fish;
  const cur = curRaw != null && !Number.isNaN(Number(curRaw)) ? Number(curRaw) : NaN;

  if (ticketSum > 0) {
    const harvested = ticketSum;
    const remaining = basis > 0 ? Math.max(0, basis - harvested) : Number.isFinite(cur) ? Math.max(0, cur) : null;
    return { fish_harvested: harvested, fish_remaining: remaining };
  }

  const harvestedMark = row.harvest_done === true || (Number(row.actual_yield) || 0) > 0;
  if (basis > 0 && harvestedMark && Number.isFinite(cur)) {
    const remaining = Math.max(0, cur);
    const harvested = Math.max(0, basis - remaining);
    return { fish_harvested: harvested, fish_remaining: remaining };
  }

  return { fish_harvested: null, fish_remaining: null };
}

/** SL cần phải thu (kg) = max(0, cột kế hoạch − cột đã thu). Không có kế hoạch (10) → null. */
function computeYieldNeedFromPlanMinusActual(planKg, actualKg) {
  const p = Number(planKg);
  const a = Number(actualKg) || 0;
  if (!Number.isFinite(p) || p <= 0) return null;
  return Math.max(0, p - a);
}

/**
 * Số cá còn lại để phân tab: chỉ sang «Chu kì đã thu» khi đã có hoạt động thu và còn = 0.
 * null = chưa xác định / chưa thu — giữ ở Chu kỳ.
 */
function effectiveFishRemainingForTabSplit(r) {
  if (r.fish_remaining != null && !Number.isNaN(Number(r.fish_remaining))) {
    return Number(r.fish_remaining);
  }
  const hasHarvest = r.harvest_done === true || (Number(r.actual_yield) || 0) > 0;
  if (!hasHarvest) return null;
  if (r.current_fish != null && !Number.isNaN(Number(r.current_fish))) {
    return Math.max(0, Number(r.current_fish));
  }
  return null;
}

function NewPondDialog({ open, onClose, onCreated, agencies, appSettings }) {
  const [households, setHouseholds] = useState([]);
  const [form, setForm] = useState({
    household_id: '',
    first_cycle_name: '',
    area: '',
    depth: '',
    location: '',
    codePreview: '',
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (open) {
      base44.entities.Household.filter({ active: true }, 'name', 500).then(setHouseholds);
      setForm({ household_id: '', first_cycle_name: '', area: '', depth: '', location: '', codePreview: '' });
      setError('');
    }
  }, [open]);

  useEffect(() => {
    if (!open || !form.household_id) {
      setForm((f) => ({ ...f, codePreview: '' }));
      return;
    }
    let cancelled = false;
    (async () => {
      try {
        const code = await base44.rpc('next_pond_code', { p_household_id: form.household_id });
        if (!cancelled) setForm((f) => ({ ...f, codePreview: code || '' }));
      } catch {
        if (!cancelled) setForm((f) => ({ ...f, codePreview: '' }));
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [open, form.household_id]);

  const selectedHousehold = households.find((h) => h.id === form.household_id);
  const agencyForHousehold = agencies.find((a) => a.id === selectedHousehold?.agency_id);

  const householdSelectItems = useMemo(
    () =>
      households.map((h) => ({
        value: h.id,
        label: `${h.name} — KV ${h.region_code} · HT ${agencies.find((a) => a.id === h.agency_id)?.code || '—'} · ĐL ${agencies.find((a) => a.id === h.agency_id)?.code || '—'} · Hộ ${h.household_segment}`,
      })),
    [households, agencies]
  );

  const handleCreate = async () => {
    if (!form.household_id) {
      setError('Chọn hộ nuôi');
      return;
    }
    setError('');
    setSaving(true);
    try {
      const code = await base44.rpc('next_pond_code', { p_household_id: form.household_id });
      const w = getWaterThresholdDefaults(appSettings);
      const pondId = await base44.rpc('create_pond_with_initial_cycle', {
        p_code: code,
        p_household_id: form.household_id,
        p_owner_name: selectedHousehold?.name || '',
        p_agency_code: agencyForHousehold?.code || null,
        p_area: Number(form.area) || null,
        p_depth: Number(form.depth) || null,
        p_location: form.location?.trim() || null,
        p_ph_min: w.ph_min,
        p_ph_max: w.ph_max,
        p_temp_min: w.temp_min,
        p_temp_max: w.temp_max,
        p_qr_code: pondQrPayload(code),
      });
      const label = form.first_cycle_name?.trim();
      if (label && pondId) {
        const cycles = await base44.entities.PondCycle.filter({ pond_id: pondId }, 'created_at', 1);
        if (cycles[0]) await base44.entities.PondCycle.update(cycles[0].id, { name: label });
      }
      onCreated();
      onClose();
    } catch (e) {
      setError(formatSupabaseError(e));
    }
    setSaving(false);
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Tạo ao nuôi mới</DialogTitle>
        </DialogHeader>
        <div className="space-y-4 py-2">
          {error && <p className="text-sm text-red-500 bg-red-50 border border-red-200 rounded px-3 py-2">{error}</p>}
          <div>
            <Label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Hộ nuôi *</Label>
            <Select value={form.household_id} onValueChange={(v) => setForm({ ...form, household_id: v })} items={householdSelectItems}>
              <SelectTrigger className="mt-1">
                <SelectValue placeholder="Chọn hộ..." />
              </SelectTrigger>
              <SelectContent>
                {householdSelectItems.map((it) => (
                  <SelectItem key={it.value} value={it.value}>
                    {it.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Mã ao (tự sinh)</Label>
            <Input value={form.codePreview || '—'} readOnly className="mt-1 font-mono bg-muted/50" />
          </div>
          <div>
            <Label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Tên chu kỳ đầu (tuỳ chọn)</Label>
            <Input className="mt-1" value={form.first_cycle_name} onChange={(e) => setForm({ ...form, first_cycle_name: e.target.value })} />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Diện tích (m²)</Label>
              <Input type="number" value={form.area} onChange={(e) => setForm({ ...form, area: e.target.value })} className="mt-1" />
            </div>
            <div>
              <Label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Độ sâu (m)</Label>
              <Input type="number" step="0.1" value={form.depth} onChange={(e) => setForm({ ...form, depth: e.target.value })} className="mt-1" />
            </div>
          </div>
          <div>
            <Label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Địa điểm</Label>
            <Input value={form.location} onChange={(e) => setForm({ ...form, location: e.target.value })} className="mt-1" />
          </div>
          <Button onClick={handleCreate} disabled={saving || households.length === 0} className="w-full bg-primary text-white">
            {saving ? 'Đang tạo...' : 'Tạo ao'}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function EditPondDialog({ open, onClose, pond, onUpdated }) {
  const [form, setForm] = useState({
    area: '',
    depth: '',
    location: '',
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (open && pond) {
      setForm({
        area: pond.area || '',
        depth: pond.depth || '',
        location: pond.location || '',
      });
      setError('');
    }
  }, [open, pond]);

  const handleUpdate = async () => {
    setSaving(true);
    try {
      await base44.entities.Pond.update(pond.id, {
        area: Number(form.area) || null,
        depth: Number(form.depth) || null,
        location: form.location?.trim() || null,
      });
      onUpdated();
      onClose();
    } catch (e) {
      setError(formatSupabaseError(e));
    }
    setSaving(false);
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Chỉnh sửa thông tin ao {pond?.code}</DialogTitle>
        </DialogHeader>
        <div className="space-y-4 py-2">
          {error && <p className="text-sm text-red-500 bg-red-50 border border-red-200 rounded px-3 py-2">{error}</p>}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Diện tích (m²)</Label>
              <Input type="number" value={form.area} onChange={(e) => setForm({ ...form, area: e.target.value })} className="mt-1" />
            </div>
            <div>
              <Label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Độ sâu (m)</Label>
              <Input type="number" step="0.1" value={form.depth} onChange={(e) => setForm({ ...form, depth: e.target.value })} className="mt-1" />
            </div>
          </div>
          <div>
            <Label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Địa điểm</Label>
            <Input value={form.location} onChange={(e) => setForm({ ...form, location: e.target.value })} className="mt-1" />
          </div>
          <Button onClick={handleUpdate} disabled={saving} className="w-full bg-primary text-white">
            {saving ? 'Đang lưu...' : 'Lưu thay đổi'}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function cycleLabel(c, idx) {
  const n = String(c?.name || '').trim();
  return n || (c?.stock_date ? `Thả ${c.stock_date}` : `Chu kỳ ${idx + 1}`);
}

export default function Ponds() {
  const { harvestAlertDays, appSettings } = useAuth();
  const [searchParams, setSearchParams] = useSearchParams();
  const tabParam = String(searchParams.get('tab') || '').trim().toLowerCase();
  const mainTab =
    tabParam === 'households' || tabParam === 'household'
      ? 'households'
      : tabParam === 'ponds' || tabParam === 'pond'
        ? 'ponds'
        : tabParam === 'harvested' || tabParam === 'cycles-harvested' || tabParam === 'cycles_harvested'
          ? 'cyclesHarvested'
          : 'cycles';

  const [ponds, setPonds] = useState([]);
  const [agencies, setAgencies] = useState([]);
  const [stockedFishByCycle, setStockedFishByCycle] = useState({});
  const [harvestRecords, setHarvestRecords] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [statusFilters, setStatusFilters] = useState(() => new Set());
  const [agencyFilters, setAgencyFilters] = useState(() => new Set());
  const [householdFilters, setHouseholdFilters] = useState(() => new Set());
  const [showNewDialog, setShowNewDialog] = useState(false);
  const [showEditDialog, setShowEditDialog] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [selectedPond, setSelectedPond] = useState(null);
  const [checkedHarvest, setCheckedHarvest] = useState(new Set());
  const [confirming, setConfirming] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [showColumnSettings, setShowColumnSettings] = useState(false);
  const [visibleCols, setVisibleCols] = useState(DEFAULT_VISIBLE_COLUMNS);
  const [viewPondId, setViewPondId] = useState(null);
  const [viewCycleId, setViewCycleId] = useState(null);
  const [editCycleId, setEditCycleId] = useState(null);
  const [newCycleOpen, setNewCycleOpen] = useState(false);
  const [newCycleSaving, setNewCycleSaving] = useState(false);
  const [newCycleErr, setNewCycleErr] = useState('');
  const [newCycleForm, setNewCycleForm] = useState({
    pond_id: '',
    name: '',
    status: 'CT',
    stock_date: '',
    total_fish: '',
    seed_size: '',
    seed_weight: '',
    survival_rate: 90,
    target_weight: 800,
    initial_expected_harvest_date: '',
  });
  const [deleteCycleId, setDeleteCycleId] = useState(null);
  const [deleteCycleLabel, setDeleteCycleLabel] = useState('');
  const [deletingCycle, setDeletingCycle] = useState(false);

  const loadPonds = async () => {
    const [data, agencyData, logRows, harvestRows] = await Promise.all([
      base44.entities.Pond.listWithHouseholds('-updated_date', 500),
      base44.entities.Agency.list('code', 200),
      base44.entities.PondLog.list('-log_date', 5000),
      base44.entities.HarvestRecord.list('-harvest_date', 8000),
    ]);
    const stockedMap = {};
    for (const log of logRows || []) {
      const cycleId = log?.pond_cycle_id;
      if (!cycleId) continue;
      stockedMap[cycleId] = (stockedMap[cycleId] || 0) + (Number(log.stocked_fish) || 0);
    }
    setPonds(data || []);
    setAgencies(agencyData || []);
    setStockedFishByCycle(stockedMap);
    setHarvestRecords(harvestRows || []);
    setLoading(false);
  };

  useEffect(() => {
    void loadPonds();
  }, []);

  const pondRows = useMemo(() => {
    const q = search.toLowerCase();
    const rows = (ponds || []).filter((p) => {
      const matchSearch = !q || [p.code, p.owner_name, p.agency_code].filter(Boolean).some((x) => String(x).toLowerCase().includes(q));
      const status = p.active_cycle?.status || 'CT';
      const matchStatus = statusFilters.size === 0 || statusFilters.has(status);
      const matchAgency = agencyFilters.size === 0 || agencyFilters.has(p.agency_code);
      const hid = p?.household_id || p?.households?.id || null;
      const matchHousehold = householdFilters.size === 0 || (hid && householdFilters.has(String(hid)));
      return matchSearch && matchStatus && matchAgency && matchHousehold;
    });
    return rows.sort((a, b) => String(a.code || '').localeCompare(String(b.code || '')));
  }, [ponds, search, statusFilters, agencyFilters, householdFilters]);

  const cycleRows = useMemo(() => {
    const ticketFishByCycle = new Map();
    const harvestKgByCycle = new Map();
    for (const h of harvestRecords || []) {
      const cid = h?.pond_cycle_id;
      if (!cid) continue;
      const k = String(cid);
      ticketFishByCycle.set(k, (ticketFishByCycle.get(k) || 0) + (Number(h.fish_count_harvested) || 0));
      harvestKgByCycle.set(k, (harvestKgByCycle.get(k) || 0) + (Number(h.actual_yield) || 0));
    }

    const rows = [];
    for (const p of ponds) {
      const cycles = Array.isArray(p.pond_cycles) ? p.pond_cycles : [];
      if (cycles.length === 0) {
        const base = {
          row_id: `${p.id}::__none__`,
          pond_id: p.id,
          pond_code: p.code,
          owner_name: p.owner_name,
          agency_code: p.agency_code,
          household_id: p?.household_id || p?.households?.id || null,
          area: p.area,
          location: p.location,
          depth: p.depth,
          cycle_id: null,
          cycle_name: 'Chưa có chu kỳ',
          status: 'CT',
          total_fish: null,
          stocked_fish_added: null,
          current_fish: null,
          expected_yield: null,
          fcr_yield_basis: null,
          actual_yield: null,
          harvest_done: false,
          expected_harvest_date: null,
          stock_date: null,
          withdrawal_end_date: null,
          fcr: null,
          total_feed_used: 0,
          raw: p,
        };
        const fish = computeFishHarvestCounts(base, ticketFishByCycle);
        rows.push({
          ...base,
          ...fish,
          actual_harvest_display_kg: null,
          yield_need_harvest: null,
        });
      } else {
        cycles.forEach((c, idx) => {
          const base = {
            row_id: `${p.id}::${c.id}`,
            pond_id: p.id,
            pond_code: p.code,
            owner_name: p.owner_name,
            agency_code: p.agency_code,
            household_id: p?.household_id || p?.households?.id || null,
            area: p.area,
            location: p.location,
            depth: p.depth,
            cycle_id: c.id,
            cycle_name: cycleLabel(c, idx),
            status: c.status || 'CT',
            total_fish: c.total_fish ?? null,
            stocked_fish_added: stockedFishByCycle[c.id] ?? 0,
            current_fish: c.current_fish ?? c.total_fish ?? null,
            expected_yield: plannedYieldAdjustedForTable(c),
            fcr_yield_basis: (() => {
              const e = Number(c.expected_yield);
              if (Number.isFinite(e) && e > 0) return e;
              return calculateCurrentYield(c);
            })(),
            actual_yield: c.actual_yield ?? null,
            harvest_done: Boolean(c.harvest_done),
            expected_harvest_date: plannedHarvestDateForDisplay(c),
            stock_date: c.stock_date,
            withdrawal_end_date: c.withdrawal_end_date,
            fcr: c.fcr,
            total_feed_used: c.total_feed_used ?? 0,
            raw: p,
          };
          const fish = computeFishHarvestCounts(base, ticketFishByCycle);
          const fromRec = harvestKgByCycle.get(String(c.id)) || 0;
          const fromCyc = Number(c.actual_yield) || 0;
          const actualHarvestKg = Math.max(fromRec, fromCyc);
          rows.push({
            ...base,
            ...fish,
            actual_harvest_display_kg: actualHarvestKg,
            yield_need_harvest: computeYieldNeedFromPlanMinusActual(base.expected_yield, actualHarvestKg),
          });
        });
      }
    }
    // Group by pond_code
    return rows.sort((a, b) => {
      if (a.pond_code !== b.pond_code) return a.pond_code.localeCompare(b.pond_code);
      // Sort cycles within pond by stock_date desc
      if (!a.stock_date) return 1;
      if (!b.stock_date) return -1;
      return b.stock_date.localeCompare(a.stock_date);
    });
  }, [ponds, stockedFishByCycle, harvestRecords]);

  const agencyCodes = [...new Set(cycleRows.map((r) => r.agency_code).filter(Boolean))];
  const agencyFilterItems = useMemo(() => agencyCodes.sort((a, b) => String(a).localeCompare(String(b), 'vi')), [agencyCodes]);

  const householdFilterItems = useMemo(() => {
    const map = new Map();
    (ponds || []).forEach((p) => {
      const hid = p?.household_id || p?.households?.id || null;
      if (!hid) return;
      const name = (p?.owner_name || p?.households?.name || '').trim();
      if (!map.has(String(hid))) {
        map.set(String(hid), { id: String(hid), name: name || '—', agency: p.agency_code || '' });
      }
    });
    return [...map.values()].sort((a, b) => {
      const aa = String(a.agency).localeCompare(String(b.agency), 'vi');
      if (aa !== 0) return aa;
      return String(a.name).localeCompare(String(b.name), 'vi');
    });
  }, [ponds]);

  const statusFilterItems = useMemo(
    () => [
      { value: 'CC', label: 'CC - Có cá' },
      { value: 'CT', label: 'CT - Chưa thả' },
    ],
    []
  );

  const today = new Date();

  const cycleColumnDefs = useMemo(() => cycleColumnDefsForMainTab(mainTab), [mainTab]);

  /** Cột mới thêm vào DEFAULT nhưng state cũ/HMR có thể thiếu key → undefined coi là ẩn; merge để mặc định bật. */
  const effectiveVisibleCols = useMemo(
    () => ({ ...DEFAULT_VISIBLE_COLUMNS, ...visibleCols }),
    [visibleCols]
  );

  const filteredRows = useMemo(() => {
    const q = search.toLowerCase();
    return cycleRows.filter((r) => {
      const matchSearch = !q || [r.pond_code, r.owner_name, r.cycle_name].filter(Boolean).some((x) => String(x).toLowerCase().includes(q));
      const matchStatus = statusFilters.size === 0 || statusFilters.has(r.status);
      const matchAgency = agencyFilters.size === 0 || agencyFilters.has(r.agency_code);
      const matchHousehold = householdFilters.size === 0 || (r.household_id && householdFilters.has(String(r.household_id)));
      if (!(matchSearch && matchStatus && matchAgency && matchHousehold)) return false;

      const rem = effectiveFishRemainingForTabSplit(r);
      const hasHarvest = r.harvest_done === true || (Number(r.actual_yield) || 0) > 0;
      // Đã thu hết cá (còn 0 con) → chỉ hiển thị tab «Chu kì đã thu»
      if (hasHarvest && rem === 0) return false;

      const hasPlan = Boolean(r.stock_date) || (Number(r.total_fish) || 0) > 0;
      const hasFish = r.status === 'CC';
      const diff = r.expected_harvest_date ? differenceInDays(parseISO(r.expected_harvest_date), today) : null;
      const isUrgent = diff !== null && diff <= harvestAlertDays;
      const isWithdrawal = r.withdrawal_end_date && differenceInDays(parseISO(r.withdrawal_end_date), today) >= 0;
      const hasAlert = Boolean(isUrgent || isWithdrawal);

      // Thu một phần (còn cá) — luôn ở Chu kỳ để theo dõi
      const partialHarvest = hasHarvest && rem != null && rem > 0;
      if (partialHarvest) return true;

      return hasPlan || hasFish || hasAlert;
    });
  }, [cycleRows, search, statusFilters, agencyFilters, householdFilters, harvestAlertDays, today]);

  const cycleTotals = useMemo(() => {
    const rows = filteredRows || [];
    const pondSet = new Set(rows.map((r) => r.pond_id).filter(Boolean));
    const sum = (key) => rows.reduce((s, r) => s + (Number(r[key]) || 0), 0);
    const sumActualHarvestKg = rows.reduce(
      (s, r) => s + (Number(r.actual_harvest_display_kg) || Number(r.actual_yield) || 0),
      0
    );
    return {
      ponds: pondSet.size,
      cycles: rows.filter((r) => r.cycle_id).length,
      sum_total_fish: sum('total_fish'),
      sum_stocked_added: sum('stocked_fish_added'),
      sum_current_fish: sum('current_fish'),
      sum_expected_yield: sum('expected_yield'),
      sum_total_feed_used: sum('total_feed_used'),
      sum_actual_yield: sumActualHarvestKg,
    };
  }, [filteredRows]);

  const filteredHarvestedRows = useMemo(() => {
    const q = search.toLowerCase();
    return cycleRows.filter((r) => {
      const matchSearch = !q || [r.pond_code, r.owner_name, r.cycle_name].filter(Boolean).some((x) => String(x).toLowerCase().includes(q));
      const matchStatus = statusFilters.size === 0 || statusFilters.has(r.status);
      const matchAgency = agencyFilters.size === 0 || agencyFilters.has(r.agency_code);
      const matchHousehold = householdFilters.size === 0 || (r.household_id && householdFilters.has(String(r.household_id)));
      if (!(matchSearch && matchStatus && matchAgency && matchHousehold)) return false;
      if (!r.cycle_id) return false;
      const rem = effectiveFishRemainingForTabSplit(r);
      const hasHarvest = r.harvest_done === true || (Number(r.actual_yield) || 0) > 0;
      return hasHarvest && rem === 0;
    });
  }, [cycleRows, search, statusFilters, agencyFilters, householdFilters]);

  const harvestedCycleTotals = useMemo(() => {
    const rows = filteredHarvestedRows || [];
    const pondSet = new Set(rows.map((r) => r.pond_id).filter(Boolean));
    const sum = (key) => rows.reduce((s, r) => s + (Number(r[key]) || 0), 0);
    const sumActualHarvestKg = rows.reduce(
      (s, r) => s + (Number(r.actual_harvest_display_kg) || Number(r.actual_yield) || 0),
      0
    );
    return {
      ponds: pondSet.size,
      cycles: rows.filter((r) => r.cycle_id).length,
      sum_total_fish: sum('total_fish'),
      sum_stocked_added: sum('stocked_fish_added'),
      sum_current_fish: sum('current_fish'),
      sum_expected_yield: sum('expected_yield'),
      sum_total_feed_used: sum('total_feed_used'),
      sum_actual_yield: sumActualHarvestKg,
    };
  }, [filteredHarvestedRows]);

  const toggleHarvestCheck = (cycleId, e) => {
    e.stopPropagation();
    if (!cycleId) return;
    setCheckedHarvest((prev) => {
      const next = new Set(prev);
      next.has(cycleId) ? next.delete(cycleId) : next.add(cycleId);
      return next;
    });
  };

  const handleConfirmHarvest = async () => {
    if (checkedHarvest.size === 0) return;
    setConfirming(true);
    await Promise.all(
      [...checkedHarvest].map(async (cycleId) => {
        await base44.entities.PondCycle.update(cycleId, { 
          harvest_done: true, 
          status: 'CT', 
          current_fish: 0
        });
      })
    );
    setCheckedHarvest(new Set());
    await loadPonds();
    setConfirming(false);
  };

  const handleDeletePond = async () => {
    if (!selectedPond) return;
    setDeleting(true);
    try {
      await base44.entities.Pond.delete(selectedPond.id);
      await loadPonds();
      setShowDeleteConfirm(false);
      setSelectedPond(null);
    } catch (e) {
      alert(formatSupabaseError(e));
    }
    setDeleting(false);
  };

  const handleDeleteCycle = async () => {
    if (!deleteCycleId) return;
    setDeletingCycle(true);
    try {
      await base44.entities.PondCycle.delete(deleteCycleId);
      await loadPonds();
      setDeleteCycleId(null);
      setDeleteCycleLabel('');
    } catch (e) {
      alert(formatSupabaseError(e));
    }
    setDeletingCycle(false);
  };

  const setMainTab = (v) => {
    const next = new URLSearchParams(searchParams);
    if (v === 'cycles') next.delete('tab');
    else if (v === 'cyclesHarvested') next.set('tab', 'harvested');
    else next.set('tab', v);
    setSearchParams(next, { replace: true });
  };

  const pondSelectItems = useMemo(
    () => [{ value: '__none__', label: '— Chọn ao —' }, ...(ponds || []).map((p) => ({ value: p.id, label: `${p.code} — ${p.owner_name || '—'}` }))],
    [ponds]
  );

  const handleCreateCycle = async () => {
    if (!newCycleForm.pond_id) {
      setNewCycleErr('Chọn ao');
      return;
    }
    if (!newCycleForm.stock_date) {
      setNewCycleErr('Nhập ngày thả');
      return;
    }
    if (!newCycleForm.total_fish) {
      setNewCycleErr('Nhập tổng cá thả');
      return;
    }
    setNewCycleSaving(true);
    setNewCycleErr('');
    try {
      const totalFishNum = Number(newCycleForm.total_fish) || 0;
      const survivalRateNum = Number(newCycleForm.survival_rate) || 0;
      const targetWeightNum = Number(newCycleForm.target_weight) || 0;
      const expectedYield =
        totalFishNum > 0 && survivalRateNum > 0 && targetWeightNum > 0
          ? Math.round((totalFishNum * (survivalRateNum / 100) * targetWeightNum) / 1000)
          : null;
      const status = newCycleForm.status === 'CC' ? 'CC' : 'CT';
      const currentFish = status === 'CC' ? totalFishNum : 0;

      await base44.entities.PondCycle.create({
        pond_id: newCycleForm.pond_id,
        status,
        name: newCycleForm.name?.trim() || null,
        stock_date: newCycleForm.stock_date || null,
        total_fish: totalFishNum || null,
        current_fish: currentFish,
        seed_size: newCycleForm.seed_size === '' ? null : Number(newCycleForm.seed_size),
        seed_weight: newCycleForm.seed_weight === '' ? null : Number(newCycleForm.seed_weight),
        survival_rate: survivalRateNum || null,
        target_weight: targetWeightNum || null,
        initial_expected_harvest_date: newCycleForm.initial_expected_harvest_date || null,
        expected_yield: expectedYield,
      });
      setNewCycleOpen(false);
      setNewCycleForm({
        pond_id: '',
        name: '',
        status: 'CT',
        stock_date: '',
        total_fish: '',
        seed_size: '',
        seed_weight: '',
        survival_rate: 90,
        target_weight: 800,
        initial_expected_harvest_date: '',
      });
      await loadPonds();
    } catch (e) {
      setNewCycleErr(formatSupabaseError(e));
    }
    setNewCycleSaving(false);
  };

  return (
    <div className="p-3 sm:p-6 w-full max-w-none">
      <Tabs
        value={mainTab}
        onValueChange={(v) => {
          setMainTab(v);
        }}
        className="w-full gap-0"
      >
        <TabsList className="inline-flex h-auto min-h-8 w-fit max-w-full shrink-0 flex-wrap items-center gap-1 rounded-md border border-border bg-muted/50 p-1 shadow-none">
          <TabsTrigger value="households" className="h-7 rounded-sm px-3 py-0 text-xs font-semibold leading-none text-muted-foreground data-[active]:bg-background data-[active]:text-foreground">Hộ nuôi</TabsTrigger>
          <TabsTrigger value="ponds" className="h-7 rounded-sm px-3 py-0 text-xs font-semibold leading-none text-muted-foreground data-[active]:bg-background data-[active]:text-foreground">Ao</TabsTrigger>
          <TabsTrigger value="cycles" className="h-7 rounded-sm px-3 py-0 text-xs font-semibold leading-none text-muted-foreground data-[active]:bg-background data-[active]:text-foreground">Chu kỳ</TabsTrigger>
          <TabsTrigger value="cyclesHarvested" className="h-7 rounded-sm px-3 py-0 text-xs font-semibold leading-none text-muted-foreground data-[active]:bg-background data-[active]:text-foreground">Chu kì đã thu</TabsTrigger>
        </TabsList>

        <div className="mt-3 flex w-full min-w-0 flex-col gap-2 sm:flex-row sm:items-center sm:justify-between sm:gap-3">
          <div className="min-w-0 flex-1">
            <h1 className="text-xl sm:text-2xl font-bold text-foreground sm:whitespace-nowrap">
              {mainTab === 'households'
                ? 'Hộ nuôi'
                : mainTab === 'ponds'
                  ? 'Quản lý ao nuôi'
                  : mainTab === 'cyclesHarvested'
                    ? 'Chu kỳ đã thu hoạch'
                    : 'Quản lý chu kỳ ao nuôi'}
            </h1>
            <p className="text-muted-foreground text-xs sm:text-sm mt-0.5">
              {mainTab === 'households'
                ? 'Mã hộ nằm trong mã ao (khu vực–đại lý–hộ–STT).'
                : mainTab === 'ponds'
                  ? `${pondRows.length} ao • ${pondRows.filter((p) => (p.active_cycle?.status || 'CT') === 'CC').length} ao đang CC`
                  : mainTab === 'cyclesHarvested'
                    ? `${filteredHarvestedRows.length} chu kỳ đã chốt thu hoạch hoặc có thực thu`
                    : `${cycleRows.length} chu kỳ • ${cycleRows.filter((r) => r.status === 'CC').length} đang CC`}
            </p>
          </div>
          {mainTab !== 'households' && (
            <div className="flex items-center gap-2 shrink-0">
              <div className="hidden sm:block"><QRBatchDownload ponds={ponds} /></div>
              {mainTab === 'cycles' || mainTab === 'cyclesHarvested' ? (
                <>
                  <Button variant="outline" className="gap-2" onClick={() => setShowColumnSettings(true)}>
                    <Settings2 className="w-4 h-4" /> Cài đặt cột
                  </Button>
                  {mainTab === 'cycles' && (
                    <Button
                      onClick={() => {
                        setNewCycleErr('');
                        setNewCycleForm({
                          pond_id: '',
                          name: '',
                          status: 'CT',
                          stock_date: '',
                          total_fish: '',
                          seed_size: '',
                          seed_weight: '',
                          survival_rate: 90,
                          target_weight: 800,
                          initial_expected_harvest_date: '',
                        });
                        setNewCycleOpen(true);
                      }}
                      className="bg-primary text-white flex items-center gap-2 text-sm"
                    >
                      <Plus className="w-4 h-4" />
                      <span className="hidden sm:inline">Thêm chu kỳ</span>
                      <span className="sm:hidden">Chu kỳ</span>
                    </Button>
                  )}
                </>
              ) : (
                <Button onClick={() => setShowNewDialog(true)} className="bg-primary text-white flex items-center gap-2 text-sm">
                  <Plus className="w-4 h-4" />
                  <span className="hidden sm:inline">Thêm ao mới</span>
                  <span className="sm:hidden">Thêm</span>
                </Button>
              )}
            </div>
          )}
        </div>

        <TabsContent value="ponds" className="mt-3 sm:mt-4 space-y-4 sm:space-y-5 outline-none">
              <div className="flex w-full min-w-0 flex-wrap gap-2 sm:gap-3 items-center">
                <div className="relative min-w-[12rem] flex-1 basis-[min(100%,24rem)]">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                  <Input placeholder="Tìm mã ao, tên chủ hộ, đại lý..." value={search} onChange={(e) => setSearch(e.target.value)} className="pl-9" />
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
                          {h.agency ? `${h.agency} — ` : ''}{h.name}
                        </DropdownMenuCheckboxItem>
                      ))}
                      <DropdownMenuSeparator />
                      <DropdownMenuItem onClick={() => setHouseholdFilters(new Set())}>Bỏ chọn</DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                )}
              </div>

              <div className="sm:hidden space-y-3">
                {loading ? (
                  Array(4).fill(0).map((_, i) => <div key={i} className="h-32 bg-muted rounded-xl animate-pulse" />)
                ) : pondRows.length === 0 ? (
                  <div className="text-center py-12 text-muted-foreground text-sm">Không tìm thấy ao nào</div>
                ) : pondRows.map((p) => (
                  <PondMobileCard
                    key={p.id}
                    pond={{
                      code: p.code,
                      owner_name: p.owner_name,
                      status: p.active_cycle?.status || 'CT',
                      area: p.area,
                      current_fish: p.active_cycle?.current_fish ?? p.active_cycle?.total_fish ?? null,
                      expected_yield: plannedYieldForDisplay(p.active_cycle),
                      expected_harvest_date: plannedHarvestDateForDisplay(p.active_cycle),
                      withdrawal_end_date: p.active_cycle?.withdrawal_end_date ?? null,
                      fcr: p.active_cycle?.fcr ?? null,
                      agency_code: p.agency_code,
                    }}
                    checked={false}
                    onCheck={() => {}}
                    onClick={() => setViewPondId(p.id)}
                    harvestAlertDays={harvestAlertDays}
                  />
                ))}
              </div>

              <div className="hidden sm:block bg-card rounded-xl border border-border shadow-sm overflow-hidden">
                <div className="overflow-x-auto">
                  <table className="w-full text-sm min-w-[640px]">
                    <thead>
                      <tr className="bg-muted/30 border-b border-border">
                        <th className="text-left px-4 py-3 text-[11px] font-bold text-muted-foreground uppercase tracking-wider whitespace-nowrap">MÃ AO</th>
                        <th className="text-left px-4 py-3 text-[11px] font-bold text-muted-foreground uppercase tracking-wider whitespace-nowrap">CHỦ HỘ</th>
                        <th className="text-left px-4 py-3 text-[11px] font-bold text-muted-foreground uppercase tracking-wider whitespace-nowrap">ĐẠI LÝ</th>
                        <th className="text-left px-4 py-3 text-[11px] font-bold text-muted-foreground uppercase tracking-wider whitespace-nowrap">TRẠNG THÁI</th>
                        <th className="text-right px-4 py-3 text-[11px] font-bold text-muted-foreground uppercase tracking-wider whitespace-nowrap">SL DỰ KIẾN (KG)</th>
                        <th className="sticky right-0 bg-muted/30 text-center px-4 py-3 text-[11px] font-bold text-muted-foreground uppercase tracking-wider whitespace-nowrap border-l border-border shadow-[-2px_0_4px_rgba(0,0,0,0.05)]">THAO TÁC</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border/60">
                      {loading ? (
                        Array(6).fill(0).map((_, i) => (
                          <tr key={i}><td className="px-4 py-3" colSpan={6}><div className="h-4 bg-muted rounded animate-pulse w-32" /></td></tr>
                        ))
                      ) : pondRows.length === 0 ? (
                        <tr><td colSpan={6} className="text-center py-12 text-muted-foreground">Không tìm thấy ao nào</td></tr>
                      ) : pondRows.map((p) => {
                        const status = p.active_cycle?.status || 'CT';
                        const currentFish = p.active_cycle?.current_fish ?? p.active_cycle?.total_fish ?? null;
                        const expectedYield = plannedYieldForDisplay(p.active_cycle);
                        return (
                          <tr
                            key={p.id}
                            onClick={() => setViewPondId(p.id)}
                            className="hover:bg-primary/5 cursor-pointer transition-colors"
                          >
                            <td className="px-4 py-3 font-bold text-slate-700 whitespace-nowrap">{p.code}</td>
                            <td className="px-4 py-3 text-slate-600 whitespace-nowrap">{p.owner_name || '—'}</td>
                            <td className="px-4 py-3 text-muted-foreground text-xs whitespace-nowrap">{p.agency_code || '—'}</td>
                            <td className="px-4 py-3 whitespace-nowrap"><PondStatusBadge status={status} /></td>
                            <td className="px-4 py-3 text-right font-bold text-slate-800 whitespace-nowrap">
                              {expectedYield != null ? Number(expectedYield).toLocaleString() : '—'}
                            </td>
                            <td className="sticky right-0 bg-card px-4 py-3 text-center whitespace-nowrap border-l border-border shadow-[-2px_0_4px_rgba(0,0,0,0.05)]" onClick={(e) => e.stopPropagation()}>
                              <DropdownMenu>
                                <DropdownMenuTrigger asChild>
                                  <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground hover:text-foreground">
                                    <MoreHorizontal className="w-4 h-4" />
                                  </Button>
                                </DropdownMenuTrigger>
                                <DropdownMenuContent align="end" className="w-32">
                                  <DropdownMenuItem onClick={() => setViewPondId(p.id)}>
                                    <Eye className="w-4 h-4 mr-2" /> Xem
                                  </DropdownMenuItem>
                                  <DropdownMenuItem onClick={() => { setSelectedPond({ id: p.id, code: p.code, area: p.area, depth: p.depth, location: p.location }); setShowEditDialog(true); }}>
                                    <Edit className="w-4 h-4 mr-2" /> Sửa
                                  </DropdownMenuItem>
                                  <DropdownMenuSeparator />
                                  <DropdownMenuItem className="text-red-600 focus:text-red-600" onClick={() => { setSelectedPond({ id: p.id, code: p.code }); setShowDeleteConfirm(true); }}>
                                    <Trash2 className="w-4 h-4 mr-2" /> Xoá
                                  </DropdownMenuItem>
                                </DropdownMenuContent>
                              </DropdownMenu>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
        </TabsContent>

        <TabsContent value="cycles" className="mt-3 sm:mt-4 space-y-4 sm:space-y-5 outline-none">
          <PondCycleListTabPanel
            variant="active"
            rows={filteredRows}
            totals={cycleTotals}
            loading={loading}
            search={search}
            setSearch={setSearch}
            statusFilters={statusFilters}
            setStatusFilters={setStatusFilters}
            statusFilterItems={statusFilterItems}
            agencyFilters={agencyFilters}
            setAgencyFilters={setAgencyFilters}
            agencyFilterItems={agencyFilterItems}
            householdFilters={householdFilters}
            setHouseholdFilters={setHouseholdFilters}
            householdFilterItems={householdFilterItems}
            checkedHarvest={checkedHarvest}
            setCheckedHarvest={setCheckedHarvest}
            toggleHarvestCheck={toggleHarvestCheck}
            handleConfirmHarvest={handleConfirmHarvest}
            confirming={confirming}
            harvestAlertDays={harvestAlertDays}
            today={today}
            visibleCols={effectiveVisibleCols}
            columnDefs={cycleColumnDefs}
            setViewCycleId={setViewCycleId}
            setViewPondId={setViewPondId}
            setEditCycleId={setEditCycleId}
            setSelectedPond={setSelectedPond}
            setShowEditDialog={setShowEditDialog}
            setDeleteCycleId={setDeleteCycleId}
            setDeleteCycleLabel={setDeleteCycleLabel}
            setShowDeleteConfirm={setShowDeleteConfirm}
          />
        </TabsContent>

        <TabsContent value="cyclesHarvested" className="mt-3 sm:mt-4 space-y-4 sm:space-y-5 outline-none">
          <PondCycleListTabPanel
            variant="harvested"
            rows={filteredHarvestedRows}
            totals={harvestedCycleTotals}
            loading={loading}
            search={search}
            setSearch={setSearch}
            statusFilters={statusFilters}
            setStatusFilters={setStatusFilters}
            statusFilterItems={statusFilterItems}
            agencyFilters={agencyFilters}
            setAgencyFilters={setAgencyFilters}
            agencyFilterItems={agencyFilterItems}
            householdFilters={householdFilters}
            setHouseholdFilters={setHouseholdFilters}
            householdFilterItems={householdFilterItems}
            checkedHarvest={checkedHarvest}
            setCheckedHarvest={setCheckedHarvest}
            toggleHarvestCheck={toggleHarvestCheck}
            handleConfirmHarvest={handleConfirmHarvest}
            confirming={confirming}
            harvestAlertDays={harvestAlertDays}
            today={today}
            visibleCols={effectiveVisibleCols}
            columnDefs={cycleColumnDefs}
            setViewCycleId={setViewCycleId}
            setViewPondId={setViewPondId}
            setEditCycleId={setEditCycleId}
            setSelectedPond={setSelectedPond}
            setShowEditDialog={setShowEditDialog}
            setDeleteCycleId={setDeleteCycleId}
            setDeleteCycleLabel={setDeleteCycleLabel}
            setShowDeleteConfirm={setShowDeleteConfirm}
          />
        </TabsContent>

        <NewPondDialog open={showNewDialog} onClose={() => setShowNewDialog(false)} onCreated={loadPonds} agencies={agencies} appSettings={appSettings} />
        <EditPondDialog open={showEditDialog} onClose={() => { setShowEditDialog(false); setSelectedPond(null); }} pond={selectedPond} onUpdated={loadPonds} />

        <AlertDialog open={showDeleteConfirm} onOpenChange={setShowDeleteConfirm}>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle className="flex items-center gap-2 text-red-600">
                  <AlertCircle className="w-5 h-5" /> Xác nhận xoá ao
                </AlertDialogTitle>
                <AlertDialogDescription>
                  Bạn có chắc chắn muốn xoá ao <strong>{selectedPond?.code}</strong>? Hành động này sẽ xoá tất cả chu kỳ và dữ liệu liên quan. Thao tác này không thể hoàn tác.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel onClick={() => setSelectedPond(null)}>Huỷ</AlertDialogCancel>
                <AlertDialogAction onClick={handleDeletePond} disabled={deleting} className="bg-red-600 hover:bg-red-700 text-white">
                  {deleting ? 'Đang xoá...' : 'Xác nhận xoá'}
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>

          <AlertDialog open={Boolean(deleteCycleId)} onOpenChange={(open) => { if (!open) { setDeleteCycleId(null); setDeleteCycleLabel(''); } }}>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle className="flex items-center gap-2 text-red-600">
                  <AlertCircle className="w-5 h-5" /> Xác nhận xoá chu kỳ
                </AlertDialogTitle>
                <AlertDialogDescription>
                  Bạn có chắc chắn muốn xoá chu kỳ <strong>{deleteCycleLabel || 'đang chọn'}</strong>? Nhật ký và phiếu thu hoạch liên quan sẽ bị xoá theo. Thao tác này không thể hoàn tác.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel onClick={() => { setDeleteCycleId(null); setDeleteCycleLabel(''); }}>Huỷ</AlertDialogCancel>
                <AlertDialogAction onClick={handleDeleteCycle} disabled={deletingCycle} className="bg-red-600 hover:bg-red-700 text-white">
                  {deletingCycle ? 'Đang xoá...' : 'Xác nhận xoá'}
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        

        <TabsContent value="households" className="mt-3 sm:mt-4 outline-none">
          <HouseholdsPanel embedded />
        </TabsContent>
      </Tabs>

      <Dialog open={showColumnSettings} onOpenChange={setShowColumnSettings}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Cài đặt cột hiển thị</DialogTitle>
          </DialogHeader>
          <div className="space-y-2 py-1">
            {cycleColumnDefs.map((col) => (
              <label key={col.key} className="flex items-center justify-between gap-3 text-sm">
                <span>{col.label}</span>
                <input
                  type="checkbox"
                  checked={Boolean(effectiveVisibleCols[col.key])}
                  onChange={(e) => setVisibleCols((prev) => ({ ...prev, [col.key]: e.target.checked }))}
                  className="h-4 w-4 accent-primary"
                />
              </label>
            ))}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setVisibleCols(DEFAULT_VISIBLE_COLUMNS)}>Đặt lại mặc định</Button>
            <Button onClick={() => setShowColumnSettings(false)}>Xong</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <PondViewDialog
        open={Boolean(viewPondId)}
        pondId={viewPondId}
        onClose={() => setViewPondId(null)}
        onEdit={(pond) => {
          setViewPondId(null);
          if (!pond) return;
          setSelectedPond({ id: pond.id, code: pond.code, area: pond.area, depth: pond.depth, location: pond.location });
          setShowEditDialog(true);
        }}
      />
      <CycleViewDialog
        open={Boolean(viewCycleId)}
        cycleId={viewCycleId}
        onClose={() => setViewCycleId(null)}
        onEdit={(cycle) => {
          setViewCycleId(null);
          if (!cycle?.id) return;
          setEditCycleId(cycle.id);
        }}
      />
      <CycleEditDialog
        open={Boolean(editCycleId)}
        cycleId={editCycleId}
        onClose={() => setEditCycleId(null)}
        onSaved={async () => {
          setEditCycleId(null);
          await loadPonds();
        }}
      />

      <Dialog open={newCycleOpen} onOpenChange={setNewCycleOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Tạo chu kỳ mới</DialogTitle>
          </DialogHeader>
          <div className="space-y-3 py-1">
            {newCycleErr && (
              <p className="text-sm text-red-600 bg-red-50 border border-red-200 rounded px-3 py-2">
                {newCycleErr}
              </p>
            )}
            <div>
              <SearchableSelect
                label="Chọn ao *"
                value={newCycleForm.pond_id || '__none__'}
                onChange={(v) => setNewCycleForm((p) => ({ ...p, pond_id: v === '__none__' ? '' : v }))}
                options={pondSelectItems}
                placeholder="Chọn ao..."
                disabled={(pondSelectItems?.length || 0) <= 1}
              />
            </div>
            <div>
              <Label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Trạng thái thả *</Label>
              <Select value={newCycleForm.status} onValueChange={(v) => setNewCycleForm((p) => ({ ...p, status: v }))}>
                <SelectTrigger className="mt-1">
                  <SelectValue placeholder="Chọn trạng thái..." />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="CC">CC — Có cá / đang nuôi</SelectItem>
                  <SelectItem value="CT">CT — Chưa thả / quay vòng</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Tên chu kỳ (tuỳ chọn)</Label>
              <Input className="mt-1" value={newCycleForm.name} onChange={(e) => setNewCycleForm((p) => ({ ...p, name: e.target.value }))} />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Ngày thả *</Label>
                <Input
                  className="mt-1"
                  type="date"
                  value={newCycleForm.stock_date}
                  onChange={(e) => setNewCycleForm((p) => ({ ...p, stock_date: e.target.value }))}
                />
              </div>
              <div>
                <Label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Thu hoạch DK (gốc)</Label>
                <Input
                  className="mt-1"
                  type="date"
                  value={newCycleForm.initial_expected_harvest_date}
                  onChange={(e) =>
                    setNewCycleForm((p) => ({ ...p, initial_expected_harvest_date: e.target.value }))
                  }
                />
              </div>
              <div>
                <Label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Tổng cá thả (con) *</Label>
                <Input
                  className="mt-1"
                  type="number"
                  value={newCycleForm.total_fish}
                  onChange={(e) => setNewCycleForm((p) => ({ ...p, total_fish: e.target.value }))}
                />
              </div>
              <div>
                <Label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Size giống (cm)</Label>
                <Input
                  className="mt-1"
                  type="number"
                  step="0.1"
                  value={newCycleForm.seed_size}
                  onChange={(e) => setNewCycleForm((p) => ({ ...p, seed_size: e.target.value }))}
                />
              </div>
              <div>
                <Label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">TL giống (g)</Label>
                <Input
                  className="mt-1"
                  type="number"
                  step="0.1"
                  value={newCycleForm.seed_weight}
                  onChange={(e) => setNewCycleForm((p) => ({ ...p, seed_weight: e.target.value }))}
                />
              </div>
              <div>
                <Label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Tỷ lệ sống (%)</Label>
                <Input
                  className="mt-1"
                  type="number"
                  value={newCycleForm.survival_rate}
                  onChange={(e) => setNewCycleForm((p) => ({ ...p, survival_rate: e.target.value }))}
                />
              </div>
              <div className="col-span-2">
                <Label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">TL kỳ vọng lúc thu (g)</Label>
                <Input
                  className="mt-1"
                  type="number"
                  value={newCycleForm.target_weight}
                  onChange={(e) => setNewCycleForm((p) => ({ ...p, target_weight: e.target.value }))}
                />
              </div>
            </div>
          </div>
          <DialogFooter className="gap-2 sm:gap-0">
            <Button type="button" variant="outline" onClick={() => setNewCycleOpen(false)} disabled={newCycleSaving}>
              Hủy
            </Button>
            <Button type="button" onClick={() => void handleCreateCycle()} disabled={newCycleSaving}>
              {newCycleSaving ? 'Đang tạo…' : 'Tạo chu kỳ'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
