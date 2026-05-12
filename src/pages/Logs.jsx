import { useState, useEffect, useMemo, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { base44 } from '@/api/base44Client';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { ClipboardList, Camera, ChevronRight, ChevronLeft, Filter, Plus, Edit, Trash2, ChevronsUpDown } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import QRScanner from '@/components/scanner/QRScanner';
import LogDetailModal from '@/components/ponds/LogDetailModal';
import PondLogEditDialog from '@/components/ponds/PondLogEditDialog';
import PondLogCreateDialog from '@/components/ponds/PondLogCreateDialog';
import { parsePondCodeFromQr, pondCodesEqual } from '@/lib/fieldAuthHelpers';
import { pickActiveCycle, cycleLabelForPondLog } from '@/lib/pondCycleHelpers';
import { formatDateDisplay } from '@/lib/dateFormat';
import { differenceInDays, parseISO } from 'date-fns';

function cellDash(v) {
  if (v === null || v === undefined || v === '') return '—';
  return v;
}

function inDateScope(logDate, logDateFrom, logDateTo, monthFilter) {
  if (!logDate) return false;
  if (logDateFrom && logDateTo) {
    return logDate >= logDateFrom && logDate <= logDateTo;
  }
  if (monthFilter !== 'all') {
    return logDate.slice(0, 7) === monthFilter;
  }
  return true;
}

function SearchableSelect({ value, onChange, options, placeholder = 'Chọn...', disabled }) {
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
      <Button
        type="button"
        variant="outline"
        disabled={disabled}
        onClick={() => setOpen((v) => !v)}
        className={`h-10 w-full justify-between px-2 font-semibold text-base ${!cur ? 'text-muted-foreground' : ''}`}
      >
        <span className="truncate text-left">{cur?.label || placeholder}</span>
        <ChevronsUpDown className="ml-2 h-5 w-5 shrink-0 opacity-50" aria-hidden />
      </Button>
      {open && !disabled && (
        <div className="absolute left-0 top-[calc(100%+4px)] z-50 w-full min-w-[12rem] rounded-lg border border-border bg-popover shadow-md">
          <div className="p-2 border-b border-border">
            <Input autoFocus value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Gõ để tìm..." className="h-9 text-base font-semibold" />
          </div>
          <div className="max-h-80 overflow-y-auto p-1">
            {filtered.length === 0 ? (
              <div className="px-2 py-2 text-sm font-semibold text-muted-foreground">Không có kết quả</div>
            ) : (
              filtered.map((o) => (
                <button
                  key={String(o.value)}
                  type="button"
                  className={`flex w-full items-center rounded-md px-2 py-2 text-left text-base font-semibold hover:bg-accent hover:text-accent-foreground ${
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

export default function Logs() {
  const navigate = useNavigate();
  const [ponds, setPonds] = useState([]);
  const [logs, setLogs] = useState([]);
  const [harvests, setHarvests] = useState([]);
  const [activePond, setActivePond] = useState(null);
  const [qrInput, setQrInput] = useState('');
  const [loading, setLoading] = useState(true);
  const [showCamera, setShowCamera] = useState(false);
  const [selectedLog, setSelectedLog] = useState(null);
  const [showLogDialog, setShowLogDialog] = useState(false);
  const [showCreateLogDialog, setShowCreateLogDialog] = useState(false);
  const [selectedPondForLog, setSelectedPondForLog] = useState(null);
  const [deletingLogId, setDeletingLogId] = useState(null);
  const [monthFilter, setMonthFilter] = useState('all');
  const [logDateFrom, setLogDateFrom] = useState('');
  const [logDateTo, setLogDateTo] = useState('');
  const [agencyFilter, setAgencyFilter] = useState('all');
  const [householdFilter, setHouseholdFilter] = useState('all');
  const [cycleFilter, setCycleFilter] = useState('all');

  const loadData = async () => {
    const [p, l, h] = await Promise.all([
      base44.entities.Pond.listWithHouseholds('-updated_date', 500),
      base44.entities.PondLog.list('-log_date', 2500),
      base44.entities.HarvestRecord.list('-harvest_date', 1500),
    ]);
    setPonds(p);
    setLogs(l);
    setHarvests(h || []);
    setLoading(false);
  };

  useEffect(() => {
    void loadData();
  }, []);

  const pondById = useMemo(() => {
    const m = new Map();
    ponds.forEach((p) => m.set(p.id, p));
    return m;
  }, [ponds]);

  const handleQrScan = (raw) => {
    const input = raw || qrInput;
    const code = parsePondCodeFromQr(input);
    if (!code) return;
    const pond = ponds.find(
      (p) => pondCodesEqual(p.code, code) || (p.qr_code && String(p.qr_code).toLowerCase().includes(String(code).toLowerCase()))
    );
    setShowCamera(false);
    if (pond) {
      setActivePond(pond);
      navigate(`/ponds/${pond.id}?tab=log`);
      setQrInput('');
    } else {
      alert(`Không tìm thấy ao: ${code}`);
    }
  };

  const agencyCodes = useMemo(
    () => [...new Set(ponds.map((p) => p.agency_code).filter(Boolean))].sort(),
    [ponds]
  );

  const agencyFilterItems = useMemo(
    () => [{ value: 'all', label: 'Tất cả đại lý' }, ...agencyCodes.map((a) => ({ value: a, label: a }))],
    [agencyCodes]
  );

  const householdFilterItems = useMemo(() => {
    const items = [{ value: 'all', label: 'Tất cả hộ nuôi' }];
    const map = new Map();
    ponds.forEach((p) => {
      const h = p?.households;
      if (!h?.id) return;
      if (!map.has(h.id)) {
        map.set(h.id, {
          id: h.id,
          name: (h.name && String(h.name).trim()) || '—',
          agency: p.agency_code || '',
        });
      }
    });
    const arr = [...map.values()].sort((a, b) => {
      const aa = a.agency.localeCompare(b.agency, 'vi');
      if (aa !== 0) return aa;
      return a.name.localeCompare(b.name, 'vi');
    });
    arr.forEach((h) => {
      const prefix = h.agency ? `${h.agency} — ` : '';
      items.push({ value: h.id, label: `${prefix}${h.name}` });
    });
    return items;
  }, [ponds]);

  const pondFilterItems = useMemo(() => {
    const items = [{ value: 'none', label: 'Chọn ao nuôi...' }];
    const sorted = [...ponds].sort((a, b) => (a.code || '').localeCompare(b.code || ''));
    sorted.forEach(p => {
      const cycle = pickActiveCycle(p.pond_cycles);
      const hasActiveCycle = !!cycle;
      items.push({ 
        value: p.id, 
        label: `${p.code} — ${p.owner_name}${hasActiveCycle ? ' ✓' : ''}`,
        hasActiveCycle 
      });
    });
    return items;
  }, [ponds]);

  const cycleFilterItems = useMemo(() => {
    const items = [{ value: 'all', label: 'Tất cả chu kỳ' }];
    const seen = new Set();
    const relevantPonds = activePond ? [activePond] : ponds;
    
    for (const p of relevantPonds) {
      const cycles = p.pond_cycles || [];
      for (const c of cycles) {
        if (!c?.id || seen.has(c.id)) continue;
        seen.add(c.id);
        const title = (c.name && String(c.name).trim()) || (c.stock_date ? `Thả ${c.stock_date}` : 'Chu kỳ');
        items.push({ value: c.id, label: `${p.code} — ${title}` });
      }
    }
    return items.sort((a, b) => String(a.label).localeCompare(String(b.label), 'vi'));
  }, [ponds, activePond]);

  const logsInScope = useMemo(() => {
    if (activePond) return logs.filter((l) => l.pond_id === activePond.id);
    return logs;
  }, [logs, activePond]);

  const allMonths = useMemo(
    () => [...new Set(logsInScope.map((l) => l.log_date?.slice(0, 7)).filter(Boolean))].sort().reverse(),
    [logsInScope]
  );

  const monthFilterItems = useMemo(
    () => [{ value: 'all', label: 'Mọi tháng' }, ...allMonths.map((m) => ({ value: m, label: m }))],
    [allMonths]
  );

  const filteredLogs = useMemo(() => {
    return logs.filter((log) => {
      const pond = pondById.get(log.pond_id);
      if (!pond) return false;
      if (activePond && log.pond_id !== activePond.id) return false;
      if (agencyFilter !== 'all' && (pond.agency_code || '') !== agencyFilter) return false;
      if (householdFilter !== 'all') {
        const hid = pond?.household_id || pond?.households?.id || null;
        if (String(hid || '') !== String(householdFilter)) return false;
      }
      if (cycleFilter !== 'all') {
        const cid = log.pond_cycle_id || pickActiveCycle(pond.pond_cycles)?.id;
        if (cid !== cycleFilter) return false;
      }
      return inDateScope(log.log_date, logDateFrom, logDateTo, monthFilter);
    });
  }, [logs, pondById, activePond, agencyFilter, householdFilter, cycleFilter, logDateFrom, logDateTo, monthFilter]);

  const filteredHarvests = useMemo(() => {
    return harvests.filter((h) => {
      const pond = pondById.get(h.pond_id);
      if (!pond) return false;
      if (activePond && h.pond_id !== activePond.id) return false;
      if (agencyFilter !== 'all' && (pond.agency_code || '') !== agencyFilter) return false;
      if (householdFilter !== 'all') {
        const hid = pond?.household_id || pond?.households?.id || null;
        if (String(hid || '') !== String(householdFilter)) return false;
      }
      if (cycleFilter !== 'all') {
        const cid = h.pond_cycle_id || pickActiveCycle(pond.pond_cycles)?.id;
        if (cid !== cycleFilter) return false;
      }
      return inDateScope(h.harvest_date, logDateFrom, logDateTo, monthFilter);
    });
  }, [harvests, pondById, activePond, agencyFilter, householdFilter, cycleFilter, logDateFrom, logDateTo, monthFilter]);

  const growthByLogId = useMemo(() => {
    const groups = new Map(); // cycleId -> logs[]
    for (const l of logs || []) {
      const cid = l?.pond_cycle_id;
      if (!cid) continue;
      if (!groups.has(cid)) groups.set(cid, []);
      groups.get(cid).push(l);
    }
    const out = new Map(); // logId -> growthPerDay
    for (const [cid, arr] of groups.entries()) {
      const sorted = [...arr].sort((a, b) => {
        const da = String(a.log_date || '');
        const db = String(b.log_date || '');
        if (da !== db) return da.localeCompare(db);
        return String(a.created_at || '').localeCompare(String(b.created_at || ''));
      });
      let prev = null;
      for (const cur of sorted) {
        const w = Number(cur?.avg_weight);
        if (!cur?.id) continue;
        if (!Number.isFinite(w) || w <= 0) {
          out.set(cur.id, null);
          continue;
        }
        if (!prev) {
          out.set(cur.id, null);
          prev = cur;
          continue;
        }
        const prevW = Number(prev?.avg_weight);
        const d0 = String(prev?.log_date || '').slice(0, 10);
        const d1 = String(cur?.log_date || '').slice(0, 10);
        let days = 0;
        try {
          days = differenceInDays(parseISO(d1), parseISO(d0));
        } catch {
          days = 0;
        }
        if (!Number.isFinite(prevW) || prevW <= 0) {
          out.set(cur.id, null);
          prev = cur;
          continue;
        }
        const diff = w - prevW;
        const denom = days > 0 ? days : 1;
        const perDay = diff / denom;
        out.set(cur.id, Number.isFinite(perDay) ? perDay : null);
        prev = cur;
      }
    }
    return out;
  }, [logs]);

  const summary = useMemo(() => {
    const nLogs = filteredLogs.length;
    const sumFeedKg = filteredLogs.reduce((s, l) => s + (Number(l.feed_amount) || 0), 0);
    const sumDead = filteredLogs.reduce((s, l) => s + (Number(l.dead_fish) || 0), 0);
    const estLossKg = filteredLogs.reduce((s, l) => {
      const w = Number(l.avg_weight) || 0;
      const d = Number(l.dead_fish) || 0;
      if (w <= 0 || d <= 0) return s;
      return s + (d * w) / 1000;
    }, 0);
    const sumHarvestKg = filteredHarvests.reduce((s, h) => s + (Number(h.actual_yield) || 0), 0);
    let fcrPeriod = null;
    if (sumHarvestKg > 0 && sumFeedKg > 0) {
      fcrPeriod = Math.round((sumFeedKg / sumHarvestKg) * 1000) / 1000;
    }
    return { nLogs, sumFeedKg, sumDead, estLossKg, sumHarvestKg, fcrPeriod };
  }, [filteredLogs, filteredHarvests]);

  const displayLogs = useMemo(() => {
    return [...filteredLogs].sort((a, b) => String(b.log_date).localeCompare(String(a.log_date)));
  }, [filteredLogs]);

  const clearDateMonth = () => {
    setLogDateFrom('');
    setLogDateTo('');
    setMonthFilter('all');
  };

  const handleCreateLog = (pond) => {
    const cycle = pickActiveCycle(pond.pond_cycles);
    if (!cycle) {
      alert('Ao này chưa có chu kỳ hoạt động. Vui lòng tạo chu kỳ trước.');
      return;
    }
    setSelectedPondForLog(pond);
    setShowCreateLogDialog(true);
  };

  const handleDeleteLog = async (log) => {
    if (!log?.id) return;
    const ok = window.confirm(`Xóa nhật ký ngày ${log.log_date || '—'} của ao ${log.pond_code || '—'}?`);
    if (!ok) return;
    setDeletingLogId(log.id);
    try {
      await base44.entities.PondLog.delete(log.id);
      if (selectedLog?.id === log.id) {
        setSelectedLog(null);
        setShowLogDialog(false);
      }
      await loadData();
    } catch (e) {
      alert(`Không xóa được nhật ký: ${e?.message || 'Lỗi không xác định'}`);
    }
    setDeletingLogId(null);
  };

  const handleLogSaved = async () => {
    await loadData();
    setShowCreateLogDialog(false);
    setSelectedPondForLog(null);
  };

  const canCreateLog = activePond && pickActiveCycle(activePond.pond_cycles);
  const logTableScrollRef = useRef(null);

  return (
    <div className="p-2 sm:p-4 space-y-3 w-full max-w-none bg-slate-50/50 min-h-screen text-base font-semibold leading-normal [&_input]:text-base [&_input]:font-semibold [&_select]:text-base [&_select]:font-semibold">
      <div className="flex items-center justify-between px-1">
        <div>
          <h1 className="text-2xl sm:text-3xl font-extrabold text-slate-800 tracking-tight">Nhật ký & Thống kê</h1>
          <p className="text-slate-600 text-sm sm:text-base font-semibold mt-0.5">Quản lý nhập liệu tập trung</p>
        </div>
      </div>

      {/* Chọn ao để ghi nhật ký */}
      <div className="bg-white rounded-xl border border-slate-200 p-4 shadow-sm">
        <Label className="text-sm font-extrabold text-slate-600 uppercase tracking-wide mb-2 block">Chọn ao để ghi nhật ký</Label>
        <div className="flex gap-2">
          <div className="flex-1 min-w-0">
            <SearchableSelect
              value={activePond?.id || 'none'}
              onChange={(v) => {
                if (v === 'none') setActivePond(null);
                else setActivePond(ponds.find((p) => p.id === v) || null);
              }}
              options={pondFilterItems}
              placeholder="Chọn ao nuôi..."
            />
          </div>
          <Button 
            onClick={() => setShowCamera(true)} 
            variant="outline"
            className="h-10 px-3 shrink-0 text-base font-bold" 
            size="sm"
          >
            <Camera className="w-5 h-5 shrink-0" aria-hidden />
            <span className="sm:ml-2 text-sm sm:text-base font-bold">Quét QR</span>
          </Button>
          {canCreateLog && (
            <Button 
              onClick={() => handleCreateLog(activePond)} 
              className="hidden sm:inline-flex bg-emerald-600 text-white h-10 px-4 shadow-sm hover:bg-emerald-700 shrink-0 text-base font-bold" 
              size="sm"
            >
              <Plus className="w-5 h-5 mr-2" />
              Ghi nhật ký
            </Button>
          )}
        </div>
        {canCreateLog && (
          <Button
            type="button"
            onClick={() => handleCreateLog(activePond)}
            className="mt-3 w-full h-12 text-base font-bold bg-emerald-600 text-white shadow-sm hover:bg-emerald-700 sm:hidden"
          >
            <Plus className="w-5 h-5 mr-2 shrink-0" />
            Ghi nhật ký
          </Button>
        )}
        {activePond && !pickActiveCycle(activePond.pond_cycles) && (
          <p className="text-sm font-semibold text-amber-800 mt-2 bg-amber-50 border border-amber-200 rounded px-3 py-2">
            ⚠️ Ao này chưa có chu kỳ hoạt động
          </p>
        )}
      </div>

      {/* Bộ lọc & Thống kê - Gộp chung */}
      <div className="bg-white rounded-xl border border-slate-200 p-4 shadow-sm space-y-4">
        {/* Bộ lọc */}
        <div>
          <Label className="text-sm font-extrabold text-slate-600 uppercase tracking-wide mb-2 block">Bộ lọc</Label>
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2">
            <Input
              type="date"
              className="h-10 text-sm font-semibold"
              placeholder="Từ ngày"
              value={logDateFrom}
              onChange={(e) => { setLogDateFrom(e.target.value); setMonthFilter('all'); }}
            />
            <Input
              type="date"
              className="h-10 text-sm font-semibold"
              placeholder="Đến ngày"
              value={logDateTo}
              onChange={(e) => { setLogDateTo(e.target.value); setMonthFilter('all'); }}
            />
            <Select value={monthFilter} onValueChange={(v) => { setMonthFilter(v); setLogDateFrom(''); setLogDateTo(''); }}>
              <SelectTrigger className="h-10 text-sm font-semibold">
                <SelectValue placeholder="Tháng" />
              </SelectTrigger>
              <SelectContent>
                {monthFilterItems.map((it) => (
                  <SelectItem key={it.value} value={it.value} className="text-sm font-semibold">{it.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={agencyFilter} onValueChange={setAgencyFilter}>
              <SelectTrigger className="h-10 text-sm font-semibold">
                <SelectValue>{agencyFilter === 'all' ? 'Tất cả đại lý' : agencyFilter}</SelectValue>
              </SelectTrigger>
              <SelectContent>
                {agencyFilterItems.map((it) => (
                  <SelectItem key={it.value} value={it.value} className="text-sm font-semibold">{it.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={householdFilter} onValueChange={setHouseholdFilter}>
              <SelectTrigger className="h-10 text-sm font-semibold">
                <SelectValue>
                  {householdFilter === 'all'
                    ? 'Tất cả hộ nuôi'
                    : householdFilterItems.find((x) => x.value === householdFilter)?.label}
                </SelectValue>
              </SelectTrigger>
              <SelectContent className="max-h-64">
                {householdFilterItems.map((it) => (
                  <SelectItem key={it.value} value={it.value} className="text-sm font-semibold">{it.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={cycleFilter} onValueChange={setCycleFilter}>
              <SelectTrigger className="h-10 text-sm font-semibold">
                <SelectValue placeholder="Chu kỳ">
                  {cycleFilter === 'all' ? 'Tất cả chu kỳ' : cycleFilterItems.find((x) => x.value === cycleFilter)?.label}
                </SelectValue>
              </SelectTrigger>
              <SelectContent className="max-h-64">
                {cycleFilterItems.map((it) => (
                  <SelectItem key={it.value} value={it.value} className="text-sm font-semibold">{it.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="flex gap-2 mt-2">
            {(logDateFrom || logDateTo || monthFilter !== 'all' || activePond || agencyFilter !== 'all' || householdFilter !== 'all' || cycleFilter !== 'all') && (
              <Button variant="outline" size="sm" className="h-10 text-sm font-bold text-red-600 hover:text-red-700 hover:bg-red-50 border-red-200" onClick={() => { 
                setLogDateFrom(''); 
                setLogDateTo(''); 
                setMonthFilter('all'); 
                setActivePond(null); 
                setAgencyFilter('all'); 
                setHouseholdFilter('all');
                setCycleFilter('all'); 
              }}>
                Xóa bộ lọc
              </Button>
            )}
          </div>
        </div>

        {/* Thống kê nhanh */}
        <div className="border-t border-slate-100 pt-3">
          <div className="grid grid-cols-2 sm:grid-cols-5 gap-2">
            <div className="rounded-lg border border-slate-200 p-2.5 bg-slate-50/50">
              <p className="text-xs font-extrabold text-slate-600 uppercase tracking-wide">Số bản ghi</p>
              <p className="text-xl font-extrabold text-slate-900 mt-0.5 tabular-nums">{summary.nLogs.toLocaleString()}</p>
            </div>
            <div className="rounded-lg border border-blue-200 p-2.5 bg-blue-50/50">
              <p className="text-xs font-extrabold text-blue-700 uppercase tracking-wide">Thức ăn (kg)</p>
              <p className="text-xl font-extrabold text-blue-800 mt-0.5 tabular-nums">
                {summary.sumFeedKg > 0 ? summary.sumFeedKg.toLocaleString(undefined, { maximumFractionDigits: 1 }) : '—'}
              </p>
            </div>
            <div className="rounded-lg border border-emerald-200 p-2.5 bg-emerald-50/50">
              <p className="text-xs font-extrabold text-emerald-700 uppercase tracking-wide">Thu hoạch (kg)</p>
              <p className="text-xl font-extrabold text-emerald-800 mt-0.5 tabular-nums">
                {summary.sumHarvestKg > 0 ? summary.sumHarvestKg.toLocaleString(undefined, { maximumFractionDigits: 0 }) : '—'}
              </p>
            </div>
            <div className="rounded-lg border border-amber-200 p-2.5 bg-amber-50/50">
              <p className="text-xs font-extrabold text-amber-700 uppercase tracking-wide">Hao hụt (con)</p>
              <p className="text-xl font-extrabold text-amber-800 mt-0.5 tabular-nums">
                {summary.sumDead.toLocaleString()}
              </p>
            </div>
            <div className="rounded-lg border border-violet-200 p-2.5 bg-violet-50/50 col-span-2 sm:col-span-1">
              <p className="text-xs font-extrabold text-violet-700 uppercase tracking-wide">FCR Kỳ lọc</p>
              <p className="text-xl font-extrabold text-violet-800 mt-0.5 tabular-nums">
                {summary.fcrPeriod != null ? summary.fcrPeriod.toLocaleString() : '—'}
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Danh sách — Full width */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden flex flex-col">
        <div className="px-4 py-3 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
          <h3 className="font-extrabold text-slate-800 flex items-center gap-2 text-base whitespace-nowrap">
            <ClipboardList className="w-5 h-5 text-primary flex-shrink-0" />
            DANH SÁCH NHẬT KÝ {activePond ? `— ${activePond.code}` : ''}
          </h3>
          <span className="text-sm font-bold text-slate-700 bg-white px-3 py-1.5 rounded-full border border-slate-200 whitespace-nowrap tabular-nums">{displayLogs.length} dòng</span>
        </div>

        <div className="min-h-[400px]">
          {loading ? (
            <div className="p-4 space-y-2">
              {Array(8).fill(0).map((_, i) => (
                <div key={i} className="h-9 bg-slate-50 rounded animate-pulse" />
              ))}
            </div>
          ) : displayLogs.length === 0 ? (
            <div className="text-center py-20">
              <div className="inline-flex items-center justify-center w-12 h-12 rounded-full bg-slate-50 mb-3">
                <Filter className="w-6 h-6 text-slate-200" />
              </div>
              <p className="text-slate-500 text-base font-semibold">Không có nhật ký nào khớp với bộ lọc hiện tại</p>
            </div>
          ) : (
            <>
              <div className="flex flex-wrap items-center justify-between gap-2 px-2 py-1.5 border-b border-slate-100 bg-slate-50/95">
                <p className="text-sm font-semibold text-slate-600 pl-1">
                  Kéo ngang (hoặc vuốt trên cảm ứng) — dùng nút để lướt nhanh
                </p>
                <div className="flex gap-1 shrink-0 pr-1">
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="h-7 w-7 p-0"
                    aria-label="Cuộn bảng sang trái"
                    onClick={() => logTableScrollRef.current?.scrollBy({ left: -320, behavior: 'smooth' })}
                  >
                    <ChevronLeft className="h-4 w-4" />
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="h-7 w-7 p-0"
                    aria-label="Cuộn bảng sang phải"
                    onClick={() => logTableScrollRef.current?.scrollBy({ left: 320, behavior: 'smooth' })}
                  >
                    <ChevronRight className="h-4 w-4" />
                  </Button>
                </div>
              </div>
              <div
                ref={logTableScrollRef}
                role="region"
                aria-label="Bảng nhật ký — cuộn ngang để xem đủ cột"
                className="overflow-x-auto overscroll-x-contain touch-pan-x scroll-smooth min-h-[360px] max-w-full"
              >
                <table className="w-full text-sm sm:text-base min-w-[1820px] border-collapse">
                  <thead>
                    <tr className="bg-muted/30 border-b border-border">
                      <th className="sticky left-0 z-10 w-[6.25rem] min-w-[6.25rem] max-w-[6.25rem] bg-muted/95 backdrop-blur-sm text-left px-2 sm:px-3 py-3 sm:py-3.5 text-xs sm:text-sm font-extrabold text-muted-foreground uppercase tracking-wide whitespace-nowrap border-r border-border/80 shadow-[2px_0_6px_-2px_rgba(0,0,0,0.06)]">
                        NGÀY
                      </th>
                      <th className="sticky left-[6.25rem] z-10 min-w-[7.5rem] bg-muted/95 backdrop-blur-sm text-left px-2 sm:px-3 py-3 sm:py-3.5 text-xs sm:text-sm font-extrabold text-muted-foreground uppercase tracking-wide whitespace-nowrap border-r border-border/80 shadow-[2px_0_6px_-2px_rgba(0,0,0,0.06)]">
                        MÃ AO
                      </th>
                      <th className="text-left px-3 sm:px-4 py-3 sm:py-3.5 text-xs sm:text-sm font-extrabold text-muted-foreground uppercase tracking-wide whitespace-nowrap">ĐẠI LÝ</th>
                      <th className="text-left px-3 sm:px-4 py-3 sm:py-3.5 text-xs sm:text-sm font-extrabold text-muted-foreground uppercase tracking-wide whitespace-nowrap min-w-[7rem]">CHU KỲ</th>
                      <th className="text-right px-3 sm:px-4 py-3 sm:py-3.5 text-xs sm:text-sm font-extrabold text-muted-foreground uppercase tracking-wide whitespace-nowrap">HAO HỤT (CON)</th>
                      <th className="text-right px-3 sm:px-4 py-3 sm:py-3.5 text-xs sm:text-sm font-extrabold text-muted-foreground uppercase tracking-wide whitespace-nowrap">THỨC ĂN (KG)</th>
                      <th className="text-left px-3 sm:px-4 py-3 sm:py-3.5 text-xs sm:text-sm font-extrabold text-muted-foreground uppercase tracking-wide whitespace-nowrap">MÃ TA</th>
                      <th className="text-right px-3 sm:px-4 py-3 sm:py-3.5 text-xs sm:text-sm font-extrabold text-muted-foreground uppercase tracking-wide whitespace-nowrap">pH</th>
                      <th className="text-right px-3 sm:px-4 py-3 sm:py-3.5 text-xs sm:text-sm font-extrabold text-muted-foreground uppercase tracking-wide whitespace-nowrap">T°</th>
                      <th className="text-right px-3 sm:px-4 py-3 sm:py-3.5 text-xs sm:text-sm font-extrabold text-muted-foreground uppercase tracking-wide whitespace-nowrap">DO</th>
                      <th className="text-right px-3 sm:px-4 py-3 sm:py-3.5 text-xs sm:text-sm font-extrabold text-muted-foreground uppercase tracking-wide whitespace-nowrap">NH3</th>
                      <th className="text-right px-3 sm:px-4 py-3 sm:py-3.5 text-xs sm:text-sm font-extrabold text-muted-foreground uppercase tracking-wide whitespace-nowrap">NO2</th>
                      <th className="text-right px-3 sm:px-4 py-3 sm:py-3.5 text-xs sm:text-sm font-extrabold text-muted-foreground uppercase tracking-wide whitespace-nowrap">H2S</th>
                      <th className="text-left px-3 sm:px-4 py-3 sm:py-3.5 text-xs sm:text-sm font-extrabold text-muted-foreground uppercase tracking-wide whitespace-nowrap min-w-[6rem]">MÀU NC</th>
                      <th className="text-right px-3 sm:px-4 py-3 sm:py-3.5 text-xs sm:text-sm font-extrabold text-muted-foreground uppercase tracking-wide whitespace-nowrap">TL TB (G)</th>
                      <th className="text-right px-3 sm:px-4 py-3 sm:py-3.5 text-xs sm:text-sm font-extrabold text-muted-foreground uppercase tracking-wide whitespace-nowrap min-w-[8.5rem]">TĂNG TRƯỞNG (G)</th>
                      <th className="text-left px-3 sm:px-4 py-3 sm:py-3.5 text-xs sm:text-sm font-extrabold text-muted-foreground uppercase tracking-wide whitespace-nowrap min-w-[8rem]">THUỐC</th>
                      <th className="text-left px-3 sm:px-4 py-3 sm:py-3.5 text-xs sm:text-sm font-extrabold text-muted-foreground uppercase tracking-wide whitespace-nowrap min-w-[8rem]">GHI CHÚ</th>
                      <th className="sticky right-0 z-10 bg-muted/95 backdrop-blur-sm px-2 sm:px-4 py-3 sm:py-3.5 text-xs sm:text-sm font-extrabold text-muted-foreground uppercase tracking-wide whitespace-nowrap w-24 border-l border-border/80 shadow-[-2px_0_6px_-2px_rgba(0,0,0,0.06)]">
                        THAO TÁC
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border/60">
                    {displayLogs.map((log) => {
                      const pond = pondById.get(log.pond_id);
                      const agency = pond?.agency_code || '—';
                      const cycleLb = cycleLabelForPondLog(log, pond);
                      return (
                        <tr
                          key={log.id}
                          className="hover:bg-primary/5 cursor-pointer group transition-colors bg-white"
                          onClick={() => {
                            setSelectedLog(log);
                            setShowLogDialog(false);
                          }}
                        >
                          <td className="sticky left-0 z-[1] w-[6.25rem] min-w-[6.25rem] max-w-[6.25rem] bg-white group-hover:bg-primary/5 px-2 sm:px-3 py-3 sm:py-3.5 text-slate-700 font-semibold whitespace-nowrap border-r border-border/60 shadow-[2px_0_6px_-2px_rgba(0,0,0,0.04)]">
                            {formatDateDisplay(log.log_date)}
                          </td>
                          <td className="sticky left-[6.25rem] z-[1] min-w-[7.5rem] bg-white group-hover:bg-primary/5 px-2 sm:px-3 py-3 sm:py-3.5 font-extrabold text-slate-900 whitespace-nowrap border-r border-border/60 shadow-[2px_0_6px_-2px_rgba(0,0,0,0.04)]">
                            {log.pond_code}
                          </td>
                          <td className="px-3 sm:px-4 py-3 sm:py-3.5 text-slate-700 font-semibold whitespace-nowrap">{agency}</td>
                          <td className="px-3 sm:px-4 py-3 sm:py-3.5 text-slate-700 font-semibold max-w-[10rem] truncate" title={cycleLb}>
                            {cycleLb}
                          </td>
                          <td className="px-3 sm:px-4 py-3 sm:py-3.5 text-right font-extrabold text-red-600 tabular-nums whitespace-nowrap">
                            {log.dead_fish > 0 ? `-${log.dead_fish}` : '—'}
                          </td>
                          <td className="px-3 sm:px-4 py-3 sm:py-3.5 text-right font-extrabold text-blue-700 tabular-nums whitespace-nowrap">
                            {log.feed_amount != null && log.feed_amount !== '' ? `${log.feed_amount}` : '—'}
                          </td>
                          <td className="px-3 sm:px-4 py-3 sm:py-3.5 text-slate-700 font-semibold whitespace-nowrap max-w-[6rem] truncate" title={log.feed_code || ''}>
                            {cellDash(log.feed_code)}
                          </td>
                          <td className={`px-3 sm:px-4 py-3 sm:py-3.5 text-right font-bold tabular-nums whitespace-nowrap ${log.ph != null && log.ph !== '' && (Number(log.ph) < 6.5 || Number(log.ph) > 8.5) ? 'text-red-600' : 'text-slate-800'}`}>
                            {cellDash(log.ph)}
                          </td>
                          <td className={`px-3 sm:px-4 py-3 sm:py-3.5 text-right font-bold tabular-nums whitespace-nowrap ${log.temperature != null && log.temperature !== '' && (Number(log.temperature) < 25 || Number(log.temperature) > 32) ? 'text-red-600' : 'text-slate-800'}`}>
                            {cellDash(log.temperature)}
                          </td>
                          <td className="px-3 sm:px-4 py-3 sm:py-3.5 text-right text-slate-800 font-bold tabular-nums whitespace-nowrap">{cellDash(log.do)}</td>
                          <td className="px-3 sm:px-4 py-3 sm:py-3.5 text-right text-slate-800 font-bold tabular-nums whitespace-nowrap">{cellDash(log.nh3)}</td>
                          <td className="px-3 sm:px-4 py-3 sm:py-3.5 text-right text-slate-800 font-bold tabular-nums whitespace-nowrap">{cellDash(log.no2)}</td>
                          <td className="px-3 sm:px-4 py-3 sm:py-3.5 text-right text-slate-800 font-bold tabular-nums whitespace-nowrap">{cellDash(log.h2s)}</td>
                          <td className="px-3 sm:px-4 py-3 sm:py-3.5 text-slate-700 font-semibold max-w-[8rem] truncate" title={log.water_color || ''}>
                            {cellDash(log.water_color)}
                          </td>
                          <td className="px-3 sm:px-4 py-3 sm:py-3.5 text-right text-slate-900 font-extrabold tabular-nums whitespace-nowrap">
                            {log.avg_weight != null && log.avg_weight !== '' ? `${log.avg_weight}` : '—'}
                          </td>
                          <td className="px-3 sm:px-4 py-3 sm:py-3.5 text-right whitespace-nowrap font-extrabold tabular-nums">
                            {(() => {
                              const g = growthByLogId.get(log.id);
                              const manual = log?.growth_g;
                              const manualN = manual == null || manual === '' ? null : Number(manual);
                              if (Number.isFinite(manualN)) {
                                const cls = manualN >= 0 ? 'text-emerald-800' : 'text-red-800';
                                return <span className={cls}>{(Math.round(manualN * 10) / 10).toLocaleString(undefined, { maximumFractionDigits: 1 })}</span>;
                              }
                              if (g == null || !Number.isFinite(g)) return <span className="text-slate-400 font-semibold">—</span>;
                              const rounded = Math.round(g * 10) / 10;
                              const cls = rounded >= 0 ? 'text-emerald-800' : 'text-red-800';
                              return <span className={cls}>{rounded.toLocaleString(undefined, { maximumFractionDigits: 1 })}</span>;
                            })()}
                          </td>
                          <td className="px-3 sm:px-4 py-3 sm:py-3.5 text-slate-700 font-semibold max-w-[10rem]">
                            <div className="truncate" title={log.medicine_used || ''}>
                              {log.medicine_used ? `💊 ${log.medicine_used}` : '—'}
                            </div>
                          </td>
                          <td className="px-3 sm:px-4 py-3 sm:py-3.5 text-slate-700 font-semibold max-w-[12rem]">
                            <div className="truncate" title={log.notes || ''}>
                              {cellDash(log.notes)}
                            </div>
                          </td>
                          <td className="sticky right-0 z-[1] px-2 sm:px-4 py-3 sm:py-3.5 text-right whitespace-nowrap bg-white group-hover:bg-primary/5 border-l border-border/60 shadow-[-2px_0_6px_-2px_rgba(0,0,0,0.04)]">
                            <div className="flex items-center justify-end gap-1 sm:gap-2">
                              <button
                                type="button"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setSelectedLog(log);
                                  setShowLogDialog(true);
                                }}
                                className="w-7 h-7 rounded-full bg-slate-100 flex items-center justify-center opacity-100 transition-colors hover:bg-slate-200"
                                title="Sửa nhật ký"
                              >
                                <Edit className="w-3.5 h-3.5 text-slate-600" />
                              </button>
                              <button
                                type="button"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  void handleDeleteLog(log);
                                }}
                                disabled={deletingLogId === log.id}
                                className="w-7 h-7 rounded-full bg-red-50 flex items-center justify-center opacity-100 transition-colors hover:bg-red-100 disabled:opacity-50"
                                title="Xóa nhật ký"
                              >
                                <Trash2 className="w-3.5 h-3.5 text-red-600" />
                              </button>
                              <div className="hidden sm:flex w-7 h-7 rounded-full bg-slate-100 items-center justify-center opacity-100">
                                <ChevronRight className="w-3.5 h-3.5 text-slate-400" />
                              </div>
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </>
          )}
        </div>
      </div>

      {showCamera && <QRScanner onScan={handleQrScan} onClose={() => setShowCamera(false)} />}
      
      {/* Modal xem chi tiết nhật ký (read-only) */}
      {selectedLog && !showLogDialog && (
        <LogDetailModal 
          log={selectedLog} 
          onClose={() => setSelectedLog(null)} 
        />
      )}
      
      {/* Dialog ghi nhật ký mới cho ao đã chọn */}
      {showCreateLogDialog && selectedPondForLog && (
        <PondLogCreateDialog
          open={showCreateLogDialog}
          onClose={() => {
            setShowCreateLogDialog(false);
            setSelectedPondForLog(null);
          }}
          pond={selectedPondForLog}
          onSaved={handleLogSaved}
        />
      )}
      
      {/* Dialog sửa nhật ký đã có */}
      {showLogDialog && selectedLog && (
        <PondLogEditDialog
          open={showLogDialog}
          onClose={() => {
            setShowLogDialog(false);
            setSelectedLog(null);
          }}
          log={selectedLog}
          onSaved={async () => {
            await loadData();
            setShowLogDialog(false);
            setSelectedLog(null);
          }}
        />
      )}
    </div>
  );
}
