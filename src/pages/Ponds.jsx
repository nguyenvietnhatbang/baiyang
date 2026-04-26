import { useState, useEffect, useMemo } from 'react';
import { useSearchParams } from 'react-router-dom';
import { base44 } from '@/api/base44Client';
import { Plus, Search } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import PondStatusBadge from '@/components/ponds/PondStatusBadge';
import PondDrawer from '@/components/ponds/PondDrawer';
import QRBatchDownload from '@/components/ponds/QRBatchDownload';
import PondMobileCard from '@/components/ponds/PondMobileCard';
import { differenceInDays, parseISO } from 'date-fns';
import { useAuth } from '@/lib/AuthContext';
import { getWaterThresholdDefaults } from '@/lib/appSettingsHelpers';
import { formatSupabaseError } from '@/lib/supabaseErrors';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { HouseholdsPanel } from '@/components/households/HouseholdsPanel';

const POND_STATUS_FILTER_ITEMS = [
  { value: 'all', label: 'Tất cả trạng thái' },
  { value: 'CC', label: 'CC - Có cá' },
  { value: 'CT', label: 'CT - Chưa thả' },
];

function NewPondDialog({ open, onClose, onCreated, agencies, appSettings }) {
  const [households, setHouseholds] = useState([]);
  const [form, setForm] = useState({
    household_id: '',
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
      setForm({ household_id: '', area: '', depth: '', location: '', codePreview: '' });
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
    return () => { cancelled = true; };
  }, [open, form.household_id]);

  const selectedHousehold = households.find((h) => h.id === form.household_id);
  const agencyForHousehold = agencies.find((a) => a.id === selectedHousehold?.agency_id);

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
      await base44.entities.Pond.create({
        code,
        household_id: form.household_id,
        owner_name: selectedHousehold?.name || '',
        agency_code: agencyForHousehold?.code || null,
        area: Number(form.area) || null,
        depth: Number(form.depth) || null,
        location: form.location?.trim() || null,
        status: 'CT',
        ph_min: w.ph_min,
        ph_max: w.ph_max,
        temp_min: w.temp_min,
        temp_max: w.temp_max,
        qr_code: `POND:${code}:${Date.now()}`,
      });
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
          {households.length === 0 && (
            <p className="text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded px-3 py-2">
              Chưa có hộ nuôi. Mở tab <strong>Hộ nuôi</strong> trong Quản lý ao để tạo trước.
            </p>
          )}
          <div>
            <Label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Hộ nuôi *</Label>
            <Select value={form.household_id} onValueChange={(v) => { setForm({ ...form, household_id: v }); setTemplatePick('__none__'); }}>
              <SelectTrigger className="mt-1">
                <SelectValue placeholder="Chọn hộ..." />
              </SelectTrigger>
              <SelectContent>
                {households.map((h) => (
                  <SelectItem key={h.id} value={h.id}>{h.name} — {h.household_segment} ({h.region_code})</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Mã ao (tự sinh)</Label>
            <Input value={form.codePreview || '—'} readOnly className="mt-1 font-mono bg-muted/50" />
            <p className="text-xs text-muted-foreground mt-0.5">
              Cấu trúc: mã tỉnh–đại lý–hộ–STT. Mã tỉnh lấy theo hộ (thường trùng tỉnh đã chọn khi tạo đại lý).
            </p>
            <p className="text-xs text-muted-foreground mt-1">
              Vụ và đợt thả nhập sau, tại tab <strong>Kế hoạch</strong> khi đăng ký kế hoạch ban đầu.
            </p>
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
            <Input value={form.location} onChange={(e) => setForm({ ...form, location: e.target.value })} className="mt-1" placeholder="Ấp, xã, huyện..." />
          </div>
          <Button onClick={handleCreate} disabled={saving || households.length === 0} className="w-full bg-primary text-white">
            {saving ? 'Đang tạo...' : 'Tạo ao'}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

export default function Ponds() {
  const { harvestAlertDays, appSettings } = useAuth();
  const [searchParams, setSearchParams] = useSearchParams();
  const mainTab = searchParams.get('tab') === 'households' ? 'households' : 'ponds';

  const [ponds, setPonds] = useState([]);
  const [agencies, setAgencies] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [agencyFilter, setAgencyFilter] = useState('all');
  const [selectedPond, setSelectedPond] = useState(null);
  const [showNewDialog, setShowNewDialog] = useState(false);
  const [checkedHarvest, setCheckedHarvest] = useState(new Set());
  const [confirming, setConfirming] = useState(false);

  const loadPonds = async () => {
    const [data, agencyData] = await Promise.all([
      base44.entities.Pond.listWithHouseholds('-updated_date', 500),
      base44.entities.Agency.list('code', 200),
    ]);
    setPonds(data);
    setAgencies(agencyData);
    setLoading(false);
    return data;
  };

  useEffect(() => { loadPonds(); }, []);

  const handlePondUpdate = async () => {
    const data = await loadPonds();
    setSelectedPond((prev) => {
      if (!prev) return null;
      const u = data.find((p) => p.id === prev.id);
      return u || prev;
    });
  };

  const agencyCodes = [...new Set(ponds.map(p => p.agency_code).filter(Boolean))];
  const agencyFilterItems = useMemo(
    () => [{ value: 'all', label: 'Tất cả đại lý' }, ...agencyCodes.map((a) => ({ value: a, label: a }))],
    [agencyCodes]
  );

  const filtered = ponds.filter(p => {
    const q = search.toLowerCase();
    const matchSearch = !q || p.code?.toLowerCase().includes(q) || p.owner_name?.toLowerCase().includes(q);
    const matchStatus = statusFilter === 'all' || p.status === statusFilter;
    const matchAgency = agencyFilter === 'all' || p.agency_code === agencyFilter;
    return matchSearch && matchStatus && matchAgency;
  });

  const today = new Date();

  const toggleHarvestCheck = (id, e) => {
    e.stopPropagation();
    setCheckedHarvest(prev => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  };

  const handleConfirmHarvest = async () => {
    if (checkedHarvest.size === 0) return;
    setConfirming(true);
    await Promise.all([...checkedHarvest].map(id =>
      base44.entities.Pond.update(id, { harvest_done: true, status: 'CT', current_fish: 0 })
    ));
    setCheckedHarvest(new Set());
    loadPonds();
    setConfirming(false);
  };

  return (
    <div className="p-3 sm:p-6 max-w-7xl mx-auto">
      <Tabs
        value={mainTab}
        onValueChange={(v) => {
          if (v === 'households') setSearchParams({ tab: 'households' });
          else setSearchParams({});
        }}
        className="w-full gap-0"
      >
        {/* Chỉ để chuyển trang — một hàng nhỏ phía trên, không chiếm diện tích */}
        <TabsList className="inline-flex h-7 w-fit shrink-0 items-center gap-0 rounded-md border border-border bg-muted/50 p-0.5 shadow-none">
          <TabsTrigger
            value="ponds"
            className="h-6 rounded-sm px-2.5 py-0 text-[11px] font-medium leading-none text-muted-foreground shadow-none transition-colors hover:text-foreground data-[active]:bg-background data-[active]:text-foreground data-[active]:shadow-sm"
          >
            Ao nuôi
          </TabsTrigger>
          <TabsTrigger
            value="households"
            className="h-6 rounded-sm px-2.5 py-0 text-[11px] font-medium leading-none text-muted-foreground shadow-none transition-colors hover:text-foreground data-[active]:bg-background data-[active]:text-foreground data-[active]:shadow-sm"
          >
            Hộ nuôi
          </TabsTrigger>
        </TabsList>

        <div className="mt-3 flex w-full min-w-0 flex-col gap-2 sm:flex-row sm:items-center sm:justify-between sm:gap-3">
          <div className="min-w-0 flex-1">
            <h1 className="text-xl sm:text-2xl font-bold text-foreground sm:whitespace-nowrap">
              {mainTab === 'households' ? 'Hộ nuôi' : 'Quản lý ao nuôi'}
            </h1>
            <p className="text-muted-foreground text-xs sm:text-sm mt-0.5">
              {mainTab === 'households'
                ? 'Mã hộ nằm trong mã ao (khu vực–đại lý–hộ–STT).'
                : `${ponds.length} ao • ${ponds.filter((p) => p.status === 'CC').length} đang có cá`}
            </p>
          </div>
          {mainTab === 'ponds' && (
            <div className="flex items-center gap-2 shrink-0">
              <div className="hidden sm:block"><QRBatchDownload ponds={filtered} /></div>
              <Button onClick={() => setShowNewDialog(true)} className="bg-primary text-white flex items-center gap-2 text-sm">
                <Plus className="w-4 h-4" />
                <span className="hidden sm:inline">Thêm ao mới</span>
                <span className="sm:hidden">Thêm</span>
              </Button>
            </div>
          )}
        </div>

        <TabsContent value="ponds" className="mt-3 sm:mt-4 space-y-4 sm:space-y-5 outline-none">
      {checkedHarvest.size > 0 && (
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 bg-green-50 border border-green-200 rounded-lg px-4 py-3">
          <p className="text-sm text-green-700 font-medium">
            Đã chọn <strong>{checkedHarvest.size}</strong> ao để chốt thu hoạch
          </p>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={() => setCheckedHarvest(new Set())}>Bỏ chọn</Button>
            <Button size="sm" className="bg-green-600 hover:bg-green-700 text-white" onClick={handleConfirmHarvest} disabled={confirming}>
              {confirming ? 'Đang xử lý...' : '✅ Xác nhận đã thu'}
            </Button>
          </div>
        </div>
      )}

      <div className="flex w-full min-w-0 flex-wrap gap-2 sm:gap-3 items-center">
        <div className="relative min-w-[12rem] flex-1 basis-[min(100%,20rem)]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            placeholder="Tìm mã ao, tên chủ hộ..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="pl-9"
          />
        </div>
        <Select value={statusFilter} onValueChange={setStatusFilter} items={POND_STATUS_FILTER_ITEMS}>
          <SelectTrigger className="w-36">
            <SelectValue>
              {POND_STATUS_FILTER_ITEMS.find((x) => x.value === statusFilter)?.label ?? statusFilter}
            </SelectValue>
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Tất cả trạng thái</SelectItem>
            <SelectItem value="CC">CC - Có cá</SelectItem>
            <SelectItem value="CT">CT - Chưa thả</SelectItem>
          </SelectContent>
        </Select>
        {agencyCodes.length > 0 && (
          <Select value={agencyFilter} onValueChange={setAgencyFilter} items={agencyFilterItems}>
            <SelectTrigger className="w-36">
              <SelectValue>{agencyFilter === 'all' ? 'Tất cả đại lý' : agencyFilter}</SelectValue>
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Tất cả đại lý</SelectItem>
              {agencyCodes.map(a => <SelectItem key={a} value={a}>{a}</SelectItem>)}
            </SelectContent>
          </Select>
        )}
      </div>

      <div className="sm:hidden space-y-3">
        {loading ? (
          Array(4).fill(0).map((_, i) => <div key={i} className="h-32 bg-muted rounded-xl animate-pulse" />)
        ) : filtered.length === 0 ? (
          <div className="text-center py-12 text-muted-foreground text-sm">Không tìm thấy ao nào</div>
        ) : filtered.map(p => (
          <PondMobileCard
            key={p.id}
            pond={p}
            checked={checkedHarvest.has(p.id)}
            onCheck={e => toggleHarvestCheck(p.id, e)}
            onClick={() => setSelectedPond(p)}
            harvestAlertDays={harvestAlertDays}
          />
        ))}
      </div>

      <div className="hidden sm:block bg-card rounded-xl border border-border shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-muted/50 border-b border-border">
                <th className="px-4 py-3 w-8"></th>
                {['Mã ao', 'Chủ hộ', 'Đại lý', 'Trạng thái', 'Diện tích', 'Số cá', 'SL dự kiến', 'FCR', 'Thu hoạch DK', 'Cảnh báo'].map(h => (
                  <th key={h} className="text-left px-4 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wide whitespace-nowrap">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {loading ? (
                Array(5).fill(0).map((_, i) => (
                  <tr key={i}>
                    {Array(10).fill(0).map((_, j) => (
                      <td key={j} className="px-4 py-3"><div className="h-4 bg-muted rounded animate-pulse w-20" /></td>
                    ))}
                  </tr>
                ))
              ) : filtered.length === 0 ? (
                <tr>
                  <td colSpan={10} className="text-center py-12 text-muted-foreground">Không tìm thấy ao nào</td>
                </tr>
              ) : filtered.map(p => {
                const diff = p.expected_harvest_date ? differenceInDays(parseISO(p.expected_harvest_date), today) : null;
                const isUrgent = diff !== null && diff <= harvestAlertDays;
                const isOverdue = diff !== null && diff < 0;
                const isWithdrawal = p.withdrawal_end_date && differenceInDays(parseISO(p.withdrawal_end_date), today) >= 0;
                return (
                  <tr
                    key={p.id}
                    onClick={() => setSelectedPond(p)}
                    className={`hover:bg-muted/30 cursor-pointer transition-colors ${isOverdue ? 'bg-red-50/40' : isUrgent ? 'bg-yellow-50/40' : ''}`}
                  >
                    <td className="px-4 py-3" onClick={e => e.stopPropagation()}>
                      {(isUrgent && p.status === 'CC') && (
                        <input type="checkbox" checked={checkedHarvest.has(p.id)} onChange={e => toggleHarvestCheck(p.id, e)} className="w-4 h-4 accent-green-600 cursor-pointer" />
                      )}
                    </td>
                    <td className="px-4 py-3 font-semibold text-primary">{p.code}</td>
                    <td className="px-4 py-3 text-foreground">{p.owner_name}</td>
                    <td className="px-4 py-3 text-muted-foreground text-xs">{p.agency_code || '—'}</td>
                    <td className="px-4 py-3"><PondStatusBadge status={p.status} /></td>
                    <td className="px-4 py-3 text-muted-foreground">{p.area ? `${p.area} m²` : '—'}</td>
                    <td className="px-4 py-3 text-right">{p.current_fish ? p.current_fish.toLocaleString() : '—'}</td>
                    <td className="px-4 py-3 text-right font-medium">{p.expected_yield ? `${p.expected_yield.toLocaleString()} kg` : '—'}</td>
                    <td className="px-4 py-3 text-center">
                      {p.fcr ? (
                        <span className={`px-1.5 py-0.5 rounded text-xs font-semibold ${p.fcr <= 1.3 ? 'bg-green-100 text-green-700' : p.fcr <= 1.6 ? 'bg-yellow-100 text-yellow-700' : 'bg-red-100 text-red-700'}`}>{p.fcr}</span>
                      ) : '—'}
                    </td>
                    <td className={`px-4 py-3 text-xs ${isUrgent ? 'font-bold text-red-600' : 'text-foreground'}`}>
                      {p.expected_harvest_date || '—'}
                      {isOverdue && <span className="text-red-500 ml-1">(QH)</span>}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex gap-1">
                        {isUrgent && <span className="text-xs px-1.5 py-0.5 bg-red-100 text-red-600 rounded font-medium">THU</span>}
                        {isWithdrawal && <span className="text-xs px-1.5 py-0.5 bg-orange-100 text-orange-600 rounded font-medium">THUỐC</span>}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {selectedPond && (
        <PondDrawer
          pond={selectedPond}
          onClose={() => setSelectedPond(null)}
          onUpdate={handlePondUpdate}
          siblingPonds={ponds}
        />
      )}

      <NewPondDialog
        open={showNewDialog}
        onClose={() => setShowNewDialog(false)}
        onCreated={loadPonds}
        agencies={agencies}
        appSettings={appSettings}
      />
        </TabsContent>

        <TabsContent value="households" className="mt-3 sm:mt-4 outline-none">
          <HouseholdsPanel embedded />
        </TabsContent>
      </Tabs>
    </div>
  );
}