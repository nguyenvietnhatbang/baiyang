import { useState, useEffect, useMemo } from 'react';
import { useSearchParams } from 'react-router-dom';
import { base44 } from '@/api/base44Client';
import { Plus, Search, Settings2 } from 'lucide-react';
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
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
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
import { plannedHarvestDateForDisplay } from '@/lib/planReportHelpers';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { HouseholdsPanel } from '@/components/households/HouseholdsPanel';
import PondViewDialog from '@/components/ponds/PondViewDialog';
import CycleViewDialog from '@/components/ponds/CycleViewDialog';
import CycleEditDialog from '@/components/ponds/CycleEditDialog';

const POND_STATUS_FILTER_ITEMS = [
  { value: 'all', label: 'Tất cả trạng thái' },
  { value: 'CC', label: 'CC - Có cá' },
  { value: 'CT', label: 'CT - Chưa thả' },
];

const CYCLE_COLUMNS = [
  { key: 'pond_code', label: 'MÃ AO' },
  { key: 'cycle_name', label: 'CHU KỲ' },
  { key: 'owner_name', label: 'CHỦ HỘ' },
  { key: 'agency_code', label: 'ĐẠI LÝ' },
  { key: 'status', label: 'TRẠNG THÁI' },
  { key: 'stock_date', label: 'NGÀY THẢ' },
  { key: 'current_fish', label: 'SỐ CÁ' },
  { key: 'expected_yield', label: 'SL DỰ KIẾN' },
  { key: 'expected_harvest_date', label: 'THU HOẠCH DK' },
  { key: 'total_feed_used', label: 'TỔNG THỨC ĂN' },
  { key: 'fcr', label: 'FCR' },
  { key: 'alerts', label: 'CẢNH BÁO' },
  { key: 'actions', label: '' },
];

const DEFAULT_VISIBLE_COLUMNS = {
  pond_code: true,
  cycle_name: true,
  owner_name: true,
  agency_code: true,
  status: true,
  stock_date: true,
  current_fish: true,
  expected_yield: true,
  expected_harvest_date: true,
  total_feed_used: true,
  fcr: true,
  alerts: true,
  actions: true,
};

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
        label: `${h.name} — ${h.household_segment} (${h.region_code})`,
      })),
    [households]
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
        : 'cycles';

  const [ponds, setPonds] = useState([]);
  const [agencies, setAgencies] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [agencyFilter, setAgencyFilter] = useState('all');
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
  const [newCycleForm, setNewCycleForm] = useState({ pond_id: '', name: '' });
  const [deleteCycleId, setDeleteCycleId] = useState(null);
  const [deleteCycleLabel, setDeleteCycleLabel] = useState('');
  const [deletingCycle, setDeletingCycle] = useState(false);

  const loadPonds = async () => {
    const [data, agencyData] = await Promise.all([
      base44.entities.Pond.listWithHouseholds('-updated_date', 500),
      base44.entities.Agency.list('code', 200),
    ]);
    setPonds(data || []);
    setAgencies(agencyData || []);
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
      const matchStatus = statusFilter === 'all' || status === statusFilter;
      const matchAgency = agencyFilter === 'all' || p.agency_code === agencyFilter;
      return matchSearch && matchStatus && matchAgency;
    });
    return rows.sort((a, b) => String(a.code || '').localeCompare(String(b.code || '')));
  }, [ponds, search, statusFilter, agencyFilter]);

  const cycleRows = useMemo(() => {
    const rows = [];
    for (const p of ponds) {
      const cycles = Array.isArray(p.pond_cycles) ? p.pond_cycles : [];
      if (cycles.length === 0) {
        rows.push({
          row_id: `${p.id}::__none__`,
          pond_id: p.id,
          pond_code: p.code,
          owner_name: p.owner_name,
          agency_code: p.agency_code,
          area: p.area,
          location: p.location,
          depth: p.depth,
          cycle_id: null,
          cycle_name: 'Chưa có chu kỳ',
          status: 'CT',
          current_fish: null,
          expected_yield: null,
          expected_harvest_date: null,
          stock_date: null,
          withdrawal_end_date: null,
          fcr: null,
          total_feed_used: 0,
          raw: p,
        });
      } else {
        cycles.forEach((c, idx) => {
          rows.push({
            row_id: `${p.id}::${c.id}`,
            pond_id: p.id,
            pond_code: p.code,
            owner_name: p.owner_name,
            agency_code: p.agency_code,
            area: p.area,
            location: p.location,
            depth: p.depth,
            cycle_id: c.id,
            cycle_name: cycleLabel(c, idx),
            status: c.status || 'CT',
            current_fish: c.current_fish ?? c.total_fish ?? null,
            expected_yield: c.expected_yield,
            expected_harvest_date: plannedHarvestDateForDisplay(c),
            stock_date: c.stock_date,
            withdrawal_end_date: c.withdrawal_end_date,
            fcr: c.fcr,
            total_feed_used: c.total_feed_used ?? 0,
            raw: p,
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
  }, [ponds]);

  const agencyCodes = [...new Set(cycleRows.map((r) => r.agency_code).filter(Boolean))];
  const agencyFilterItems = useMemo(
    () => [{ value: 'all', label: 'Tất cả đại lý' }, ...agencyCodes.map((a) => ({ value: a, label: a }))],
    [agencyCodes]
  );

  const filteredRows = useMemo(() => {
    const q = search.toLowerCase();
    return cycleRows.filter((r) => {
      const matchSearch = !q || [r.pond_code, r.owner_name, r.cycle_name].filter(Boolean).some((x) => String(x).toLowerCase().includes(q));
      const matchStatus = statusFilter === 'all' || r.status === statusFilter;
      const matchAgency = agencyFilter === 'all' || r.agency_code === agencyFilter;
      return matchSearch && matchStatus && matchAgency;
    });
  }, [cycleRows, search, statusFilter, agencyFilter]);

  const today = new Date();

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
    setNewCycleSaving(true);
    setNewCycleErr('');
    try {
      await base44.entities.PondCycle.create({
        pond_id: newCycleForm.pond_id,
        status: 'CT',
        name: newCycleForm.name?.trim() || null,
      });
      setNewCycleOpen(false);
      setNewCycleForm({ pond_id: '', name: '' });
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
        <TabsList className="inline-flex h-8 w-fit shrink-0 items-center gap-0 rounded-md border border-border bg-muted/50 p-1 shadow-none">
          <TabsTrigger value="households" className="h-7 rounded-sm px-3 py-0 text-xs font-semibold leading-none text-muted-foreground data-[active]:bg-background data-[active]:text-foreground">Hộ nuôi</TabsTrigger>
          <TabsTrigger value="ponds" className="h-7 rounded-sm px-3 py-0 text-xs font-semibold leading-none text-muted-foreground data-[active]:bg-background data-[active]:text-foreground">Ao</TabsTrigger>
          <TabsTrigger value="cycles" className="h-7 rounded-sm px-3 py-0 text-xs font-semibold leading-none text-muted-foreground data-[active]:bg-background data-[active]:text-foreground">Chu kỳ</TabsTrigger>
        </TabsList>

        <div className="mt-3 flex w-full min-w-0 flex-col gap-2 sm:flex-row sm:items-center sm:justify-between sm:gap-3">
          <div className="min-w-0 flex-1">
            <h1 className="text-xl sm:text-2xl font-bold text-foreground sm:whitespace-nowrap">
              {mainTab === 'households' ? 'Hộ nuôi' : mainTab === 'ponds' ? 'Quản lý ao nuôi' : 'Quản lý chu kỳ ao nuôi'}
            </h1>
            <p className="text-muted-foreground text-xs sm:text-sm mt-0.5">
              {mainTab === 'households'
                ? 'Mã hộ nằm trong mã ao (khu vực–đại lý–hộ–STT).'
                : mainTab === 'ponds'
                  ? `${pondRows.length} ao • ${pondRows.filter((p) => (p.active_cycle?.status || 'CT') === 'CC').length} ao đang CC`
                  : `${cycleRows.length} chu kỳ • ${cycleRows.filter((r) => r.status === 'CC').length} đang CC`}
            </p>
          </div>
          {mainTab !== 'households' && (
            <div className="flex items-center gap-2 shrink-0">
              <div className="hidden sm:block"><QRBatchDownload ponds={ponds} /></div>
              {mainTab === 'cycles' ? (
                <>
                  <Button variant="outline" className="gap-2" onClick={() => setShowColumnSettings(true)}>
                    <Settings2 className="w-4 h-4" /> Cài đặt cột
                  </Button>
                  <Button
                    onClick={() => {
                      setNewCycleErr('');
                      setNewCycleForm({ pond_id: '', name: '' });
                      setNewCycleOpen(true);
                    }}
                    className="bg-primary text-white flex items-center gap-2 text-sm"
                  >
                    <Plus className="w-4 h-4" />
                    <span className="hidden sm:inline">Thêm chu kỳ</span>
                    <span className="sm:hidden">Chu kỳ</span>
                  </Button>
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
                <Select value={statusFilter} onValueChange={setStatusFilter} items={POND_STATUS_FILTER_ITEMS}>
                  <SelectTrigger className="w-36"><SelectValue>{POND_STATUS_FILTER_ITEMS.find((x) => x.value === statusFilter)?.label}</SelectValue></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Tất cả trạng thái</SelectItem>
                    <SelectItem value="CC">CC - Có cá</SelectItem>
                    <SelectItem value="CT">CT - Chưa thả</SelectItem>
                  </SelectContent>
                </Select>
                {agencyCodes.length > 0 && (
                  <Select value={agencyFilter} onValueChange={setAgencyFilter} items={agencyFilterItems}>
                    <SelectTrigger className="w-36"><SelectValue>{agencyFilter === 'all' ? 'Tất cả đại lý' : agencyFilter}</SelectValue></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">Tất cả đại lý</SelectItem>
                      {agencyCodes.map((a) => <SelectItem key={a} value={a}>{a}</SelectItem>)}
                    </SelectContent>
                  </Select>
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
                      expected_yield: p.active_cycle?.expected_yield ?? null,
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
                  <table className="w-full text-sm min-w-[900px]">
                    <thead>
                      <tr className="bg-muted/30 border-b border-border">
                        <th className="text-left px-4 py-3 text-[11px] font-bold text-muted-foreground uppercase tracking-wider whitespace-nowrap">MÃ AO</th>
                        <th className="text-left px-4 py-3 text-[11px] font-bold text-muted-foreground uppercase tracking-wider whitespace-nowrap">CHỦ HỘ</th>
                        <th className="text-left px-4 py-3 text-[11px] font-bold text-muted-foreground uppercase tracking-wider whitespace-nowrap">ĐẠI LÝ</th>
                        <th className="text-left px-4 py-3 text-[11px] font-bold text-muted-foreground uppercase tracking-wider whitespace-nowrap">TRẠNG THÁI</th>
                        <th className="text-left px-4 py-3 text-[11px] font-bold text-muted-foreground uppercase tracking-wider whitespace-nowrap">NGÀY THẢ</th>
                        <th className="text-left px-4 py-3 text-[11px] font-bold text-muted-foreground uppercase tracking-wider whitespace-nowrap">THU HOẠCH DK</th>
                        <th className="text-right px-4 py-3 text-[11px] font-bold text-muted-foreground uppercase tracking-wider whitespace-nowrap">SỐ CÁ</th>
                        <th className="text-right px-4 py-3 text-[11px] font-bold text-muted-foreground uppercase tracking-wider whitespace-nowrap">SL DỰ KIẾN</th>
                        <th className="sticky right-0 bg-muted/30 text-center px-4 py-3 text-[11px] font-bold text-muted-foreground uppercase tracking-wider whitespace-nowrap border-l border-border shadow-[-2px_0_4px_rgba(0,0,0,0.05)]">THAO TÁC</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border/60">
                      {loading ? (
                        Array(6).fill(0).map((_, i) => (
                          <tr key={i}><td className="px-4 py-3" colSpan={9}><div className="h-4 bg-muted rounded animate-pulse w-32" /></td></tr>
                        ))
                      ) : pondRows.length === 0 ? (
                        <tr><td colSpan={9} className="text-center py-12 text-muted-foreground">Không tìm thấy ao nào</td></tr>
                      ) : pondRows.map((p) => {
                        const status = p.active_cycle?.status || 'CT';
                        const currentFish = p.active_cycle?.current_fish ?? p.active_cycle?.total_fish ?? null;
                        const expectedYield = p.active_cycle?.expected_yield ?? null;
                        const expectedHarvestDate = plannedHarvestDateForDisplay(p.active_cycle);
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
                            <td className="px-4 py-3 text-slate-500 text-xs whitespace-nowrap">{p.active_cycle?.stock_date || '—'}</td>
                            <td className="px-4 py-3 text-slate-600 text-xs whitespace-nowrap">{expectedHarvestDate || '—'}</td>
                            <td className="px-4 py-3 text-right font-medium text-slate-700 whitespace-nowrap">
                              {currentFish != null && !Number.isNaN(Number(currentFish)) ? Number(currentFish).toLocaleString() : '—'}
                            </td>
                            <td className="px-4 py-3 text-right font-bold text-slate-800 whitespace-nowrap">
                              {expectedYield != null && (Number(currentFish) > 0 || status === 'CC') ? `${Number(expectedYield).toLocaleString()} kg` : '—'}
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
          {checkedHarvest.size > 0 && (
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 bg-green-50 border border-green-200 rounded-lg px-4 py-3">
              <p className="text-sm text-green-700 font-medium">Đã chọn <strong>{checkedHarvest.size}</strong> chu kỳ để chốt thu hoạch</p>
              <div className="flex gap-2">
                <Button variant="outline" size="sm" onClick={() => setCheckedHarvest(new Set())}>Bỏ chọn</Button>
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
            <Select value={statusFilter} onValueChange={setStatusFilter} items={POND_STATUS_FILTER_ITEMS}>
              <SelectTrigger className="w-36"><SelectValue>{POND_STATUS_FILTER_ITEMS.find((x) => x.value === statusFilter)?.label}</SelectValue></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Tất cả trạng thái</SelectItem>
                <SelectItem value="CC">CC - Có cá</SelectItem>
                <SelectItem value="CT">CT - Chưa thả</SelectItem>
              </SelectContent>
            </Select>
            {agencyCodes.length > 0 && (
              <Select value={agencyFilter} onValueChange={setAgencyFilter} items={agencyFilterItems}>
                <SelectTrigger className="w-36"><SelectValue>{agencyFilter === 'all' ? 'Tất cả đại lý' : agencyFilter}</SelectValue></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Tất cả đại lý</SelectItem>
                  {agencyCodes.map((a) => <SelectItem key={a} value={a}>{a}</SelectItem>)}
                </SelectContent>
              </Select>
            )}
          </div>

          <div className="sm:hidden space-y-3">
            {loading ? (
              Array(4).fill(0).map((_, i) => <div key={i} className="h-32 bg-muted rounded-xl animate-pulse" />)
            ) : filteredRows.length === 0 ? (
              <div className="text-center py-12 text-muted-foreground text-sm">Không tìm thấy chu kỳ nào</div>
            ) : filteredRows.map((r) => (
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
                }}
                checked={r.cycle_id ? checkedHarvest.has(r.cycle_id) : false}
                onCheck={(e) => toggleHarvestCheck(r.cycle_id, e)}
                onClick={() => (r.cycle_id ? setViewCycleId(r.cycle_id) : setViewPondId(r.pond_id))}
                harvestAlertDays={harvestAlertDays}
              />
            ))}
          </div>

          <div className="hidden sm:block bg-card rounded-xl border border-border shadow-sm overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-sm min-w-[1000px]">
                <thead>
                  <tr className="bg-muted/30 border-b border-border">
                    <th className="px-4 py-3 w-8 whitespace-nowrap" />
                    {CYCLE_COLUMNS.filter((c) => visibleCols[c.key] && c.key !== 'actions').map((h) => (
                      <th key={h.key} className="text-left px-4 py-3 text-[11px] font-bold text-muted-foreground uppercase tracking-wider whitespace-nowrap">{h.label}</th>
                    ))}
                    {visibleCols.actions && (
                      <th className="sticky right-0 bg-muted/30 text-center px-4 py-3 text-[11px] font-bold text-muted-foreground uppercase tracking-wider whitespace-nowrap border-l border-border shadow-[-2px_0_4px_rgba(0,0,0,0.05)]">THAO TÁC</th>
                    )}
                  </tr>
                </thead>
                <tbody className="divide-y divide-border/60">
                  {loading ? (
                    Array(6).fill(0).map((_, i) => (
                      <tr key={i}><td className="px-4 py-3" colSpan={CYCLE_COLUMNS.length + 1}><div className="h-4 bg-muted rounded animate-pulse w-32" /></td></tr>
                    ))
                  ) : filteredRows.length === 0 ? (
                    <tr><td colSpan={CYCLE_COLUMNS.length + 1} className="text-center py-12 text-muted-foreground">Không tìm thấy chu kỳ nào</td></tr>
                  ) : filteredRows.map((r, idx) => {
                    const prevRow = filteredRows[idx - 1];
                    const isNewGroup = !prevRow || prevRow.pond_code !== r.pond_code;
                    const diff = r.expected_harvest_date ? differenceInDays(parseISO(r.expected_harvest_date), today) : null;
                    const isUrgent = diff !== null && diff <= harvestAlertDays;
                    const isOverdue = diff !== null && diff < 0;
                    const isWithdrawal = r.withdrawal_end_date && differenceInDays(parseISO(r.withdrawal_end_date), today) >= 0;
                    const rowBgClass = isOverdue ? 'bg-red-50/40' : isUrgent ? 'bg-yellow-50/40' : 'bg-card';

                    return (
                      <tr
                        key={r.row_id}
                        onClick={() => (r.cycle_id ? setViewCycleId(r.cycle_id) : setViewPondId(r.pond_id))}
                        className={`hover:bg-primary/5 cursor-pointer transition-colors ${isNewGroup ? 'border-t-2 border-t-muted/40' : ''} ${isOverdue ? 'bg-red-50/40' : isUrgent ? 'bg-yellow-50/40' : ''}`}
                      >
                        <td className="px-4 py-3 whitespace-nowrap" onClick={(e) => e.stopPropagation()}>
                          {(isUrgent && r.status === 'CC' && r.cycle_id) && (
                            <input type="checkbox" checked={checkedHarvest.has(r.cycle_id)} onChange={(e) => toggleHarvestCheck(r.cycle_id, e)} className="w-4 h-4 accent-green-600 cursor-pointer" />
                          )}
                        </td>
                        {visibleCols.pond_code && (
                          <td className="px-4 py-3 font-bold text-slate-700 whitespace-nowrap">
                            {r.pond_code}
                          </td>
                        )}
                        {visibleCols.cycle_name && <td className="px-4 py-3 text-slate-600 font-medium whitespace-nowrap">{r.cycle_name}</td>}
                        {visibleCols.owner_name && <td className="px-4 py-3 text-slate-600 whitespace-nowrap">{r.owner_name}</td>}
                        {visibleCols.agency_code && <td className="px-4 py-3 text-muted-foreground text-xs whitespace-nowrap">{r.agency_code || '—'}</td>}
                        {visibleCols.status && <td className="px-4 py-3 whitespace-nowrap"><PondStatusBadge status={r.status} /></td>}
                        {visibleCols.stock_date && <td className="px-4 py-3 text-slate-500 text-xs whitespace-nowrap">{r.stock_date || '—'}</td>}
                        {visibleCols.current_fish && (
                          <td className="px-4 py-3 text-right font-medium text-slate-700 whitespace-nowrap">
                            {r.current_fish != null && !Number.isNaN(Number(r.current_fish))
                              ? Number(r.current_fish).toLocaleString()
                              : '—'}
                          </td>
                        )}
                        {visibleCols.expected_yield && (
                          <td className="px-4 py-3 text-right font-bold text-slate-800 whitespace-nowrap">
                            {r.expected_yield != null && (r.current_fish > 0 || r.status === 'CC')
                              ? `${Number(r.expected_yield).toLocaleString()} kg` 
                              : '—'}
                          </td>
                        )}
                        {visibleCols.expected_harvest_date && <td className={`px-4 py-3 text-xs whitespace-nowrap ${isUrgent ? 'font-bold text-red-600' : 'text-slate-600'}`}>{r.expected_harvest_date || '—'}{isOverdue && <span className="text-red-500 ml-1">(QH)</span>}</td>}
                        {visibleCols.total_feed_used && (
                          <td className="px-4 py-3 text-right text-blue-600 font-medium whitespace-nowrap">
                            {r.total_feed_used > 0 ? `${Number(r.total_feed_used).toLocaleString()} kg` : '—'}
                          </td>
                        )}
                        {visibleCols.fcr && (
                          <td className="px-4 py-3 text-center whitespace-nowrap">
                            {(() => {
                              // Ưu tiên FCR đã lưu trong DB
                              if (r.fcr != null) {
                                return (
                                  <span className={`px-1.5 py-0.5 rounded text-xs font-semibold ${r.fcr <= 1.3 ? 'bg-green-100 text-green-700' : r.fcr <= 1.6 ? 'bg-yellow-100 text-yellow-700' : 'bg-red-100 text-red-700'}`}>
                                    {r.fcr}
                                  </span>
                                );
                              }
                              // Nếu chưa có (đang nuôi), tính tạm: Tổng thức ăn / Sản lượng dự kiến
                              if (r.total_feed_used > 0 && r.expected_yield > 0) {
                                const tempFcr = Math.round((r.total_feed_used / r.expected_yield) * 100) / 100;
                                return (
                                  <span className="px-1.5 py-0.5 rounded text-xs font-semibold bg-slate-100 text-slate-500">
                                    {tempFcr}
                                  </span>
                                );
                              }
                              return '—';
                            })()}
                          </td>
                        )}
                        {visibleCols.alerts && (
                          <td className="px-4 py-3">
                            <div className="flex gap-1">
                              {isUrgent && <span className="text-[10px] px-1.5 py-0.5 bg-red-100 text-red-600 rounded-sm font-bold tracking-tight">THU</span>}
                              {isWithdrawal && <span className="text-[10px] px-1.5 py-0.5 bg-orange-100 text-orange-600 rounded-sm font-bold tracking-tight">THUỐC</span>}
                            </div>
                          </td>
                        )}
                        {visibleCols.actions && (
                          <td className={`sticky right-0 ${rowBgClass} px-4 py-3 text-center whitespace-nowrap border-l border-border shadow-[-2px_0_4px_rgba(0,0,0,0.05)]`} onClick={(e) => e.stopPropagation()}>
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
                                <DropdownMenuItem onClick={() => {
                                  if (r.cycle_id) {
                                    setEditCycleId(r.cycle_id);
                                  } else {
                                    setSelectedPond({ id: r.pond_id, code: r.pond_code, area: r.area, depth: r.depth, location: r.location });
                                    setShowEditDialog(true);
                                  }
                                }}>
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
                                  <DropdownMenuItem className="text-red-600 focus:text-red-600" onClick={() => { setSelectedPond({ id: r.pond_id, code: r.pond_code }); setShowDeleteConfirm(true); }}>
                                    <Trash2 className="w-4 h-4 mr-2" /> Xoá
                                  </DropdownMenuItem>
                                )}
                              </DropdownMenuContent>
                            </DropdownMenu>
                          </td>
                        )}
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
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
            {CYCLE_COLUMNS.map((col) => (
              <label key={col.key} className="flex items-center justify-between gap-3 text-sm">
                <span>{col.label}</span>
                <input
                  type="checkbox"
                  checked={Boolean(visibleCols[col.key])}
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
            {newCycleErr && <p className="text-sm text-red-600 bg-red-50 border border-red-200 rounded px-3 py-2">{newCycleErr}</p>}
            <div>
              <Label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Chọn ao *</Label>
              <Select
                value={newCycleForm.pond_id || '__none__'}
                onValueChange={(v) => setNewCycleForm((p) => ({ ...p, pond_id: v === '__none__' ? '' : v }))}
                items={pondSelectItems}
              >
                <SelectTrigger className="mt-1">
                  <SelectValue placeholder="Chọn ao..." />
                </SelectTrigger>
                <SelectContent className="max-h-72">
                  <SelectItem value="__none__">— Chọn ao —</SelectItem>
                  {(ponds || []).map((p) => (
                    <SelectItem key={p.id} value={p.id}>
                      {p.code} — {p.owner_name || '—'}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Tên chu kỳ (tuỳ chọn)</Label>
              <Input className="mt-1" value={newCycleForm.name} onChange={(e) => setNewCycleForm((p) => ({ ...p, name: e.target.value }))} />
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
