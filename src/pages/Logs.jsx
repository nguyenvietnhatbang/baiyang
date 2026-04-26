import { useState, useEffect, useMemo } from 'react';
import { base44 } from '@/api/base44Client';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { QrCode, Search, ClipboardList, Camera, ChevronRight, Filter } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import PondDrawer from '@/components/ponds/PondDrawer';
import QRScanner from '@/components/scanner/QRScanner';
import LogDetailModal from '@/components/ponds/LogDetailModal';

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

export default function Logs() {
  const [ponds, setPonds] = useState([]);
  const [logs, setLogs] = useState([]);
  const [harvests, setHarvests] = useState([]);
  const [seasons, setSeasons] = useState([]);
  const [search, setSearch] = useState('');
  const [selectedPond, setSelectedPond] = useState(null);
  const [activePond, setActivePond] = useState(null);
  const [qrInput, setQrInput] = useState('');
  const [loading, setLoading] = useState(true);
  const [showCamera, setShowCamera] = useState(false);
  const [selectedLog, setSelectedLog] = useState(null);
  const [monthFilter, setMonthFilter] = useState('all');
  const [logDateFrom, setLogDateFrom] = useState('');
  const [logDateTo, setLogDateTo] = useState('');
  const [agencyFilter, setAgencyFilter] = useState('all');
  const [seasonFilter, setSeasonFilter] = useState('all');

  const loadData = async () => {
    const [p, l, h, s] = await Promise.all([
      base44.entities.Pond.listWithHouseholds('-updated_date', 500),
      base44.entities.PondLog.list('-log_date', 2500),
      base44.entities.HarvestRecord.list('-harvest_date', 1500),
      base44.entities.Season.filter({ active: true }, 'code', 100),
    ]);
    setPonds(p);
    setLogs(l);
    setHarvests(h || []);
    setSeasons(s || []);
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
    if (!input.trim()) return;
    const code = input.replace('POND:', '').split(':')[0].trim();
    const pond = ponds.find((p) => p.code === code || p.qr_code?.includes(code));
    setShowCamera(false);
    if (pond) {
      setSelectedPond(pond);
      setQrInput('');
    } else {
      alert(`Không tìm thấy ao: ${code}`);
    }
  };

  const filteredPonds = useMemo(() => {
    const q = search.toLowerCase();
    return ponds.filter((p) => {
      const matchSearch = !q || p.code?.toLowerCase().includes(q) || p.owner_name?.toLowerCase().includes(q);
      return matchSearch && p.status === 'CC';
    });
  }, [ponds, search]);

  const agencyCodes = useMemo(
    () => [...new Set(ponds.map((p) => p.agency_code).filter(Boolean))].sort(),
    [ponds]
  );

  const seasonFilterItems = useMemo(
    () => [
      { value: 'all', label: 'Tất cả vụ' },
      ...seasons.map((s) => ({
        value: s.id,
        label: `${s.code}${s.name ? ` — ${s.name}` : ''}`,
      })),
    ],
    [seasons]
  );

  const agencyFilterItems = useMemo(
    () => [{ value: 'all', label: 'Tất cả đại lý' }, ...agencyCodes.map((a) => ({ value: a, label: a }))],
    [agencyCodes]
  );

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
      if (seasonFilter !== 'all' && pond.season_id !== seasonFilter) return false;
      return inDateScope(log.log_date, logDateFrom, logDateTo, monthFilter);
    });
  }, [logs, pondById, activePond, agencyFilter, seasonFilter, logDateFrom, logDateTo, monthFilter]);

  const filteredHarvests = useMemo(() => {
    return harvests.filter((h) => {
      const pond = pondById.get(h.pond_id);
      if (!pond) return false;
      if (activePond && h.pond_id !== activePond.id) return false;
      if (agencyFilter !== 'all' && (pond.agency_code || '') !== agencyFilter) return false;
      if (seasonFilter !== 'all' && pond.season_id !== seasonFilter) return false;
      return inDateScope(h.harvest_date, logDateFrom, logDateTo, monthFilter);
    });
  }, [harvests, pondById, activePond, agencyFilter, seasonFilter, logDateFrom, logDateTo, monthFilter]);

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

  const pondLogs = activePond ? logs.filter((l) => l.pond_id === activePond.id) : [];

  const clearDateMonth = () => {
    setLogDateFrom('');
    setLogDateTo('');
    setMonthFilter('all');
  };

  return (
    <div className="p-3 sm:p-6 space-y-4 max-w-7xl mx-auto">
      <div>
        <h1 className="text-xl sm:text-2xl font-bold text-foreground">Nhật ký ao nuôi</h1>
        <p className="text-muted-foreground text-xs sm:text-sm mt-0.5">
          Nhập liệu hàng ngày • {logs.length} bản ghi trong hệ thống
        </p>
      </div>

      {/* Bộ lọc — trên cùng */}
      <div className="bg-card rounded-xl border border-border p-4 shadow-sm space-y-4">
        <div className="flex items-center gap-2 text-sm font-semibold text-foreground">
          <Filter className="w-4 h-4 text-primary" />
          Lọc nhật ký &amp; thống kê
        </div>
        <div className="flex flex-col gap-4">
          <p className="text-[11px] text-muted-foreground -mt-1">
            Chọn khoảng ngày hoặc một tháng (không dùng cùng lúc). Đại lý / vụ lọc theo ao tương ứng.
          </p>
          <div className="flex flex-wrap items-end gap-x-4 gap-y-4">
            <div className="w-full min-w-0 md:flex-1 md:min-w-[17rem]">
              <Label className="text-xs font-medium text-muted-foreground">Khoảng ngày (nhật ký &amp; thu hoạch)</Label>
              <div className="flex flex-wrap gap-2 mt-1 items-center">
                <Input
                  type="date"
                  className="h-9 text-sm w-[9.5rem] sm:w-36 shrink-0"
                  value={logDateFrom}
                  onChange={(e) => {
                    setLogDateFrom(e.target.value);
                    setMonthFilter('all');
                  }}
                />
                <span className="text-muted-foreground text-sm">→</span>
                <Input
                  type="date"
                  className="h-9 text-sm w-[9.5rem] sm:w-36 shrink-0"
                  value={logDateTo}
                  onChange={(e) => {
                    setLogDateTo(e.target.value);
                    setMonthFilter('all');
                  }}
                />
              </div>
            </div>
            <div className="w-full sm:w-48 sm:shrink-0 min-w-0">
              <Label className="text-xs font-medium text-muted-foreground">Hoặc theo tháng</Label>
              <Select
                value={monthFilter}
                onValueChange={(v) => {
                  setMonthFilter(v);
                  setLogDateFrom('');
                  setLogDateTo('');
                }}
                items={monthFilterItems}
              >
                <SelectTrigger className="h-9 text-sm mt-1 w-full min-w-0">
                  <SelectValue>{monthFilterItems.find((x) => x.value === monthFilter)?.label ?? monthFilter}</SelectValue>
                </SelectTrigger>
                <SelectContent>
                  {monthFilterItems.map((it) => (
                    <SelectItem key={it.value} value={it.value}>
                      {it.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="w-full sm:w-48 sm:shrink-0 min-w-0">
              <Label className="text-xs font-medium text-muted-foreground">Đại lý</Label>
              <Select value={agencyFilter} onValueChange={setAgencyFilter} items={agencyFilterItems}>
                <SelectTrigger className="h-9 text-sm mt-1 w-full min-w-0">
                  <SelectValue>{agencyFilter === 'all' ? 'Tất cả đại lý' : agencyFilter}</SelectValue>
                </SelectTrigger>
                <SelectContent>
                  {agencyFilterItems.map((it) => (
                    <SelectItem key={it.value} value={it.value}>
                      {it.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="w-full sm:min-w-[14rem] sm:max-w-xs sm:flex-1 min-w-0">
              <Label className="text-xs font-medium text-muted-foreground">Vụ nuôi (theo ao)</Label>
              <Select value={seasonFilter} onValueChange={setSeasonFilter} items={seasonFilterItems}>
                <SelectTrigger className="h-9 text-sm mt-1 w-full min-w-0">
                  <SelectValue>
                    {seasonFilter === 'all' ? 'Tất cả vụ' : seasonFilterItems.find((x) => x.value === seasonFilter)?.label}
                  </SelectValue>
                </SelectTrigger>
                <SelectContent className="max-h-64">
                  {seasonFilterItems.map((it) => (
                    <SelectItem key={it.value} value={it.value}>
                      {it.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="flex flex-wrap gap-2 w-full sm:w-auto sm:shrink-0">
              <Button type="button" variant="outline" size="sm" className="h-9" onClick={clearDateMonth}>
                Xóa ngày/tháng
              </Button>
              {activePond && (
                <Button type="button" variant="secondary" size="sm" className="h-9" onClick={() => setActivePond(null)}>
                  Bỏ chọn ao
                </Button>
              )}
            </div>
          </div>
        </div>
        {activePond && (
          <p className="text-xs text-primary font-medium">
            Đang lọc theo ao: <strong>{activePond.code}</strong> — kết quả bên dưới chỉ áp dụng ao này.
          </p>
        )}
      </div>

      {/* Tổng hợp sau lọc */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
        <div className="rounded-xl border border-border bg-muted/30 px-4 py-3">
          <p className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wide">Bản ghi NK</p>
          <p className="text-xl font-bold text-foreground mt-1">{summary.nLogs.toLocaleString()}</p>
        </div>
        <div className="rounded-xl border border-border bg-blue-50/80 dark:bg-blue-950/20 px-4 py-3">
          <p className="text-[11px] font-semibold text-blue-800 dark:text-blue-300 uppercase tracking-wide">Thức ăn</p>
          <p className="text-xl font-bold text-blue-900 dark:text-blue-100 mt-1">
            {summary.sumFeedKg > 0 ? `${summary.sumFeedKg.toLocaleString(undefined, { maximumFractionDigits: 1 })} kg` : '—'}
          </p>
        </div>
        <div className="rounded-xl border border-border bg-emerald-50/80 dark:bg-emerald-950/20 px-4 py-3">
          <p className="text-[11px] font-semibold text-emerald-800 dark:text-emerald-300 uppercase tracking-wide">Thu hoạch (kg)</p>
          <p className="text-xl font-bold text-emerald-900 dark:text-emerald-100 mt-1">
            {summary.sumHarvestKg > 0 ? `${summary.sumHarvestKg.toLocaleString(undefined, { maximumFractionDigits: 0 })} kg` : '—'}
          </p>
          <p className="text-[10px] text-muted-foreground mt-0.5">Từ phiếu thu trong cùng bộ lọc</p>
        </div>
        <div className="rounded-xl border border-border bg-amber-50/80 dark:bg-amber-950/20 px-4 py-3">
          <p className="text-[11px] font-semibold text-amber-900 dark:text-amber-200 uppercase tracking-wide">Hao ước (kg)</p>
          <p className="text-xl font-bold text-amber-950 dark:text-amber-100 mt-1">
            {summary.estLossKg > 0 ? `${summary.estLossKg.toLocaleString(undefined, { maximumFractionDigits: 1 })} kg` : '—'}
          </p>
          <p className="text-[10px] text-muted-foreground mt-0.5">
            Σ (chết × TL TB ÷ 1000) khi có TL TB trong NK • {summary.sumDead.toLocaleString()} con
          </p>
        </div>
        <div className="rounded-xl border border-border bg-violet-50/80 dark:bg-violet-950/20 px-4 py-3 col-span-2 sm:col-span-1">
          <p className="text-[11px] font-semibold text-violet-800 dark:text-violet-300 uppercase tracking-wide">FCR kỳ lọc</p>
          <p className="text-xl font-bold text-violet-900 dark:text-violet-100 mt-1">
            {summary.fcrPeriod != null ? summary.fcrPeriod.toLocaleString() : '—'}
          </p>
          <p className="text-[10px] text-muted-foreground mt-0.5">Thức ăn ÷ thu hoạch (kg), cần có thu trong kỳ</p>
        </div>
      </div>

      {/* QR Scan */}
      <div className="bg-card rounded-xl border border-border p-4 shadow-sm">
        <div className="flex items-center gap-2 mb-3">
          <QrCode className="w-4 h-4 text-primary" />
          <h3 className="font-semibold text-foreground text-sm">Nhập nhanh qua mã QR</h3>
        </div>
        <div className="flex gap-2">
          <Input
            placeholder="Nhập mã ao (VD: AO-001)..."
            value={qrInput}
            onChange={(e) => setQrInput(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleQrScan()}
            className="flex-1 text-sm"
          />
          <Button onClick={() => handleQrScan()} variant="outline" size="sm">
            <QrCode className="w-4 h-4" />
          </Button>
          <Button onClick={() => setShowCamera(true)} className="bg-primary text-white" size="sm">
            <Camera className="w-4 h-4 mr-1" />
            <span className="hidden sm:inline">Quét</span>
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <div className="flex flex-col gap-3">
          <div className="bg-card rounded-xl border border-border shadow-sm overflow-hidden">
            <div className="px-3 py-2.5 border-b border-border">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
                <Input
                  placeholder="Tìm ao..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="pl-8 h-7 text-xs"
                />
              </div>
            </div>
            <div className="overflow-y-auto max-h-64">
              {filteredPonds.length === 0 && (
                <p className="text-center py-6 text-xs text-muted-foreground">Không có ao CC nào</p>
              )}
              {filteredPonds.map((p) => (
                <button
                  key={p.id}
                  type="button"
                  onClick={() => setActivePond(activePond?.id === p.id ? null : p)}
                  className={`w-full text-left px-3 py-2.5 border-b border-border/50 transition-colors flex items-center justify-between ${
                    activePond?.id === p.id ? 'bg-primary/10 border-l-2 border-l-primary' : 'hover:bg-muted/50'
                  }`}
                >
                  <div>
                    <p className="font-semibold text-xs text-primary">{p.code}</p>
                    <p className="text-xs text-muted-foreground">{p.owner_name}</p>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <span className="text-xs px-1.5 py-0.5 bg-blue-100 text-blue-700 rounded font-medium">CC</span>
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        setSelectedPond(p);
                      }}
                      className="text-xs px-1.5 py-0.5 bg-primary text-white rounded font-medium hover:bg-primary/80"
                      title="Nhập nhật ký"
                    >
                      + Log
                    </button>
                  </div>
                </button>
              ))}
            </div>
          </div>

          {activePond && (
            <div className="bg-card rounded-xl border border-border shadow-sm overflow-hidden">
              <div className="px-3 py-2.5 border-b border-border bg-primary/5">
                <p className="text-xs font-bold text-primary">
                  {activePond.code} — {activePond.owner_name}
                </p>
                <p className="text-xs text-muted-foreground mt-0.5">Lịch sử {pondLogs.length} bản ghi</p>
              </div>
              <div className="overflow-y-auto max-h-72 divide-y divide-border/50">
                {pondLogs.length === 0 ? (
                  <p className="text-center py-6 text-xs text-muted-foreground">Chưa có nhật ký</p>
                ) : (
                  pondLogs.map((log) => (
                    <button
                      key={log.id}
                      type="button"
                      onClick={() => setSelectedLog(log)}
                      className="w-full text-left px-3 py-2.5 hover:bg-muted/40 transition-colors flex items-center justify-between"
                    >
                      <div>
                        <p className="text-xs font-semibold text-foreground">{log.log_date}</p>
                        <div className="flex gap-2 mt-0.5 text-xs text-muted-foreground">
                          {log.ph && <span>pH {log.ph}</span>}
                          {log.temperature && <span>T° {log.temperature}</span>}
                          {log.dead_fish > 0 && <span className="text-red-500">-{log.dead_fish}c</span>}
                          {log.feed_amount && <span className="text-blue-500">{log.feed_amount}kg</span>}
                          {log.medicine_used && <span className="text-orange-500">💊</span>}
                        </div>
                      </div>
                      <ChevronRight className="w-3.5 h-3.5 text-muted-foreground flex-shrink-0" />
                    </button>
                  ))
                )}
              </div>
            </div>
          )}
        </div>

        <div className="lg:col-span-2 bg-card rounded-xl border border-border shadow-sm overflow-hidden flex flex-col">
          <div className="px-4 py-3 border-b border-border flex items-center justify-between gap-2 flex-wrap">
            <h3 className="font-semibold text-foreground flex items-center gap-2 text-sm">
              <ClipboardList className="w-4 h-4 text-primary" />
              {activePond ? `Nhật ký: ${activePond.code}` : 'Danh sách nhật ký (đã lọc)'}
            </h3>
            <p className="text-xs text-muted-foreground">{displayLogs.length} dòng</p>
          </div>

          <div className="overflow-y-auto flex-1" style={{ maxHeight: '560px' }}>
            {loading ? (
              <div className="p-4 space-y-2">
                {Array(5)
                  .fill(0)
                  .map((_, i) => (
                    <div key={i} className="h-10 bg-muted rounded animate-pulse" />
                  ))}
              </div>
            ) : displayLogs.length === 0 ? (
              <div className="text-center py-10 text-muted-foreground text-sm">Không có nhật ký khớp bộ lọc</div>
            ) : (
              <>
                <div className="sm:hidden divide-y divide-border">
                  {displayLogs.map((log) => (
                    <button
                      key={log.id}
                      type="button"
                      onClick={() => setSelectedLog(log)}
                      className="w-full text-left px-4 py-3 hover:bg-muted/30 transition-colors"
                    >
                      <div className="flex justify-between items-start">
                        <div>
                          <span className="font-semibold text-primary text-sm">{log.pond_code}</span>
                          <span className="text-muted-foreground text-xs ml-2">{log.log_date}</span>
                        </div>
                        <ChevronRight className="w-4 h-4 text-muted-foreground" />
                      </div>
                      <div className="flex gap-3 mt-1 text-xs text-muted-foreground flex-wrap">
                        {log.ph && <span>pH {log.ph}</span>}
                        {log.temperature && <span>T° {log.temperature}°C</span>}
                        {log.dead_fish > 0 && <span className="text-red-500">-{log.dead_fish} con</span>}
                        {log.feed_amount && <span className="text-blue-600">{log.feed_amount}kg TA</span>}
                        {log.medicine_used && <span className="text-orange-500">💊 {log.medicine_used}</span>}
                      </div>
                    </button>
                  ))}
                </div>

                <table className="hidden sm:table w-full text-sm">
                  <thead>
                    <tr className="bg-muted/30 sticky top-0">
                      <th className="text-left px-4 py-2 text-xs font-semibold text-muted-foreground">Ngày</th>
                      <th className="text-left px-4 py-2 text-xs font-semibold text-muted-foreground">Mã ao</th>
                      <th className="text-right px-4 py-2 text-xs font-semibold text-muted-foreground">Hao hụt</th>
                      <th className="text-right px-4 py-2 text-xs font-semibold text-muted-foreground">Thức ăn</th>
                      <th className="text-right px-4 py-2 text-xs font-semibold text-muted-foreground">pH</th>
                      <th className="text-right px-4 py-2 text-xs font-semibold text-muted-foreground">T°</th>
                      <th className="px-4 py-2" />
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border">
                    {displayLogs.map((log) => (
                      <tr
                        key={log.id}
                        className="hover:bg-muted/20 cursor-pointer"
                        onClick={() => setSelectedLog(log)}
                      >
                        <td className="px-4 py-2 text-muted-foreground text-xs">{log.log_date}</td>
                        <td className="px-4 py-2 font-medium text-primary">{log.pond_code}</td>
                        <td className="px-4 py-2 text-right text-red-500">{log.dead_fish > 0 ? `-${log.dead_fish}` : '—'}</td>
                        <td className="px-4 py-2 text-right text-blue-600">{log.feed_amount ? `${log.feed_amount}kg` : '—'}</td>
                        <td
                          className={`px-4 py-2 text-right text-xs ${log.ph && (log.ph < 6.5 || log.ph > 8.5) ? 'text-red-500 font-bold' : ''}`}
                        >
                          {log.ph || '—'}
                        </td>
                        <td
                          className={`px-4 py-2 text-right text-xs ${log.temperature && (log.temperature < 25 || log.temperature > 32) ? 'text-red-500 font-bold' : ''}`}
                        >
                          {log.temperature || '—'}
                        </td>
                        <td className="px-4 py-2 text-right">
                          <ChevronRight className="w-3.5 h-3.5 text-muted-foreground inline" />
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </>
            )}
          </div>
        </div>
      </div>

      {showCamera && <QRScanner onScan={handleQrScan} onClose={() => setShowCamera(false)} />}

      {selectedPond && (
        <PondDrawer
          pond={selectedPond}
          onClose={() => setSelectedPond(null)}
          onUpdate={() => {
            void loadData();
            setSelectedPond(null);
          }}
        />
      )}

      {selectedLog && <LogDetailModal log={selectedLog} onClose={() => setSelectedLog(null)} />}
    </div>
  );
}
