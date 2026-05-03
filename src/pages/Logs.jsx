import { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { base44 } from '@/api/base44Client';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { QrCode, ClipboardList, Camera, ChevronRight, Filter, Plus, Edit } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import QRScanner from '@/components/scanner/QRScanner';
import LogDetailModal from '@/components/ponds/LogDetailModal';
import PondLogEditDialog from '@/components/ponds/PondLogEditDialog';
import { parsePondCodeFromQr, pondCodesEqual } from '@/lib/fieldAuthHelpers';
import { pickActiveCycle } from '@/lib/pondCycleHelpers';
import { format } from 'date-fns';

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
  const [selectedPondForLog, setSelectedPondForLog] = useState(null);
  const [monthFilter, setMonthFilter] = useState('all');
  const [logDateFrom, setLogDateFrom] = useState('');
  const [logDateTo, setLogDateTo] = useState('');
  const [agencyFilter, setAgencyFilter] = useState('all');
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

  const pondFilterItems = useMemo(() => {
    const items = [{ value: 'all', label: 'Tất cả các ao' }];
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
      if (cycleFilter !== 'all') {
        const cid = log.pond_cycle_id || pickActiveCycle(pond.pond_cycles)?.id;
        if (cid !== cycleFilter) return false;
      }
      return inDateScope(log.log_date, logDateFrom, logDateTo, monthFilter);
    });
  }, [logs, pondById, activePond, agencyFilter, cycleFilter, logDateFrom, logDateTo, monthFilter]);

  const filteredHarvests = useMemo(() => {
    return harvests.filter((h) => {
      const pond = pondById.get(h.pond_id);
      if (!pond) return false;
      if (activePond && h.pond_id !== activePond.id) return false;
      if (agencyFilter !== 'all' && (pond.agency_code || '') !== agencyFilter) return false;
      if (cycleFilter !== 'all') {
        const cid = h.pond_cycle_id || pickActiveCycle(pond.pond_cycles)?.id;
        if (cid !== cycleFilter) return false;
      }
      return inDateScope(h.harvest_date, logDateFrom, logDateTo, monthFilter);
    });
  }, [harvests, pondById, activePond, agencyFilter, cycleFilter, logDateFrom, logDateTo, monthFilter]);

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
    setShowLogDialog(true);
  };

  const handleLogSaved = async () => {
    await loadData();
    setShowLogDialog(false);
    setSelectedPondForLog(null);
  };

  return (
    <div className="p-2 sm:p-4 space-y-3 max-w-7xl mx-auto bg-slate-50/50 min-h-screen">
      <div className="flex items-center justify-between px-1">
        <div>
          <h1 className="text-lg sm:text-xl font-bold text-slate-800">Nhật ký & Thống kê</h1>
          <p className="text-slate-500 text-[10px] sm:text-xs">Quản lý nhập liệu tập trung</p>
        </div>
        <div className="flex gap-2">
           <Button onClick={() => setShowCamera(true)} className="bg-primary text-white h-8 text-xs shadow-sm" size="sm">
            <Camera className="w-3.5 h-3.5 mr-1.5" />
            Quét QR
          </Button>
          {activePond && pickActiveCycle(activePond.pond_cycles) && (
            <Button 
              onClick={() => handleCreateLog(activePond)} 
              className="bg-emerald-600 text-white h-8 text-xs shadow-sm hover:bg-emerald-700" 
              size="sm"
            >
              <Plus className="w-3.5 h-3.5 mr-1.5" />
              Ghi nhật ký
            </Button>
          )}
        </div>
      </div>

      {/* Bộ lọc — Thu gọn và chuyên nghiệp hơn */}
      <div className="bg-white rounded-xl border border-slate-200 p-3 shadow-sm space-y-3">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
          
          {/* Nhóm 1: Thời gian (4 cols) */}
          <div className="lg:col-span-4 space-y-2.5">
            <div className="flex items-center justify-between">
              <Label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Thời gian</Label>
              <button onClick={clearDateMonth} className="text-[10px] text-primary hover:underline">Xóa mốc</button>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <Input
                type="date"
                className="h-8 text-[11px] px-2"
                value={logDateFrom}
                onChange={(e) => { setLogDateFrom(e.target.value); setMonthFilter('all'); }}
              />
              <Input
                type="date"
                className="h-8 text-[11px] px-2"
                value={logDateTo}
                onChange={(e) => { setLogDateTo(e.target.value); setMonthFilter('all'); }}
              />
            </div>
            <Select value={monthFilter} onValueChange={(v) => { setMonthFilter(v); setLogDateFrom(''); setLogDateTo(''); }}>
              <SelectTrigger className="h-8 text-[11px]">
                <SelectValue placeholder="Chọn tháng" />
              </SelectTrigger>
              <SelectContent>
                {monthFilterItems.map((it) => (
                  <SelectItem key={it.value} value={it.value} className="text-xs">{it.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Nhóm 2: Đối tượng (8 cols) */}
          <div className="lg:col-span-8 space-y-2.5">
             <Label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Đối tượng lọc</Label>
             <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                <Select value={activePond?.id || 'all'} onValueChange={(v) => {
                  const pond = v === 'all' ? null : ponds.find(p => p.id === v);
                  setActivePond(pond);
                }}>
                  <SelectTrigger className="h-8 text-[11px]">
                    <SelectValue placeholder="Chọn ao nuôi">
                      {activePond ? `${activePond.code} — ${activePond.owner_name}` : 'Tất cả các ao'}
                    </SelectValue>
                  </SelectTrigger>
                  <SelectContent className="max-h-80">
                    {pondFilterItems.map((it) => (
                      <SelectItem key={it.value} value={it.value} className="text-xs">
                        {it.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>

                <Select value={agencyFilter} onValueChange={setAgencyFilter}>
                  <SelectTrigger className="h-8 text-[11px]">
                    <SelectValue placeholder="Đại lý">
                      {agencyFilter === 'all' ? 'Tất cả đại lý' : agencyFilter}
                    </SelectValue>
                  </SelectTrigger>
                  <SelectContent>
                    {agencyFilterItems.map((it) => (
                      <SelectItem key={it.value} value={it.value} className="text-xs">{it.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>

                <Select value={cycleFilter} onValueChange={setCycleFilter}>
                  <SelectTrigger className="h-8 text-[11px]">
                    <SelectValue placeholder="Chu kỳ">
                      {cycleFilter === 'all' ? 'Tất cả chu kỳ' : cycleFilterItems.find((x) => x.value === cycleFilter)?.label}
                    </SelectValue>
                  </SelectTrigger>
                  <SelectContent className="max-h-64">
                    {cycleFilterItems.map((it) => (
                      <SelectItem key={it.value} value={it.value} className="text-xs">{it.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
             </div>

             <div className="flex gap-2">
                <div className="relative flex-1">
                  <QrCode className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400" />
                  <Input
                    placeholder="Quét hoặc nhập mã ao nhanh..."
                    value={qrInput}
                    onChange={(e) => setQrInput(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && handleQrScan()}
                    className="pl-8 h-8 text-[11px] bg-slate-50 border-dashed"
                  />
                </div>
                {(activePond || agencyFilter !== 'all' || cycleFilter !== 'all') && (
                  <Button variant="ghost" size="sm" className="h-8 text-[10px] text-red-500 hover:text-red-600 hover:bg-red-50" onClick={() => { setActivePond(null); setAgencyFilter('all'); setCycleFilter('all'); }}>
                    Xóa tất cả lọc
                  </Button>
                )}
             </div>
          </div>
        </div>
      </div>

      {/* Thống kê nhanh — Nhỏ gọn hơn */}
      <div className="grid grid-cols-2 sm:grid-cols-5 gap-2 px-0.5">
        <div className="bg-white rounded-lg border border-slate-200 p-2.5 shadow-sm">
          <p className="text-[9px] font-bold text-slate-400 uppercase tracking-tight">Số bản ghi</p>
          <p className="text-sm font-bold text-slate-700 mt-0.5">{summary.nLogs.toLocaleString()}</p>
        </div>
        <div className="bg-white rounded-lg border border-slate-200 p-2.5 shadow-sm border-l-4 border-l-blue-500">
          <p className="text-[9px] font-bold text-blue-500 uppercase tracking-tight">Thức ăn</p>
          <p className="text-sm font-bold text-slate-700 mt-0.5">
            {summary.sumFeedKg > 0 ? `${summary.sumFeedKg.toLocaleString(undefined, { maximumFractionDigits: 1 })} kg` : '—'}
          </p>
        </div>
        <div className="bg-white rounded-lg border border-slate-200 p-2.5 shadow-sm border-l-4 border-l-emerald-500">
          <p className="text-[9px] font-bold text-emerald-500 uppercase tracking-tight">Thu hoạch</p>
          <p className="text-sm font-bold text-slate-700 mt-0.5">
            {summary.sumHarvestKg > 0 ? `${summary.sumHarvestKg.toLocaleString(undefined, { maximumFractionDigits: 0 })} kg` : '—'}
          </p>
        </div>
        <div className="bg-white rounded-lg border border-slate-200 p-2.5 shadow-sm border-l-4 border-l-amber-500">
          <p className="text-[9px] font-bold text-amber-500 uppercase tracking-tight">Hao hụt</p>
          <p className="text-sm font-bold text-slate-700 mt-0.5">
            {summary.sumDead.toLocaleString()} con
          </p>
        </div>
        <div className="bg-white rounded-lg border border-slate-200 p-2.5 shadow-sm border-l-4 border-l-violet-500 col-span-2 sm:col-span-1">
          <p className="text-[9px] font-bold text-violet-500 uppercase tracking-tight">FCR Kỳ lọc</p>
          <p className="text-sm font-bold text-slate-700 mt-0.5">
            {summary.fcrPeriod != null ? summary.fcrPeriod.toLocaleString() : '—'}
          </p>
        </div>
      </div>

      {/* Danh sách — Full width */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden flex flex-col">
        <div className="px-4 py-2.5 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
          <h3 className="font-bold text-slate-700 flex items-center gap-2 text-xs">
            <ClipboardList className="w-3.5 h-3.5 text-primary" />
            DANH SÁCH NHẬT KÝ {activePond ? `— ${activePond.code}` : ''}
          </h3>
          <span className="text-[10px] font-medium text-slate-400 bg-white px-2 py-0.5 rounded-full border border-slate-200">{displayLogs.length} dòng</span>
        </div>

        <div className="overflow-x-auto min-h-[400px]">
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
              <p className="text-slate-400 text-xs">Không có nhật ký nào khớp với bộ lọc hiện tại</p>
            </div>
          ) : (
            <>
              {/* Mobile View Card-like List */}
              <div className="sm:hidden divide-y divide-slate-100">
                {displayLogs.map((log) => (
                  <button
                    key={log.id}
                    type="button"
                    onClick={() => setSelectedLog(log)}
                    className="w-full text-left px-4 py-3 hover:bg-slate-50/50 transition-colors"
                  >
                    <div className="flex justify-between items-start">
                      <div>
                        <span className="font-bold text-slate-700 text-xs">{log.pond_code}</span>
                        <span className="text-slate-400 text-[10px] ml-2 font-medium">{log.log_date}</span>
                      </div>
                      <ChevronRight className="w-3.5 h-3.5 text-slate-300" />
                    </div>
                    <div className="flex gap-2.5 mt-1.5 text-[10px] text-slate-500 font-medium">
                      {log.ph && <span className="bg-slate-100 px-1.5 py-0.5 rounded">pH {log.ph}</span>}
                      {log.dead_fish > 0 && <span className="text-red-500 bg-red-50 px-1.5 py-0.5 rounded">-{log.dead_fish}</span>}
                      {log.feed_amount && <span className="text-blue-600 bg-blue-50 px-1.5 py-0.5 rounded">{log.feed_amount}kg</span>}
                    </div>
                  </button>
                ))}
              </div>

              {/* Desktop Table View */}
              <table className="hidden sm:table w-full text-[11px]">
                <thead>
                  <tr className="bg-slate-50/80 border-b border-slate-100 sticky top-0 z-10">
                    <th className="text-left px-4 py-2.5 font-bold text-slate-500 uppercase tracking-wider w-24">Ngày</th>
                    <th className="text-left px-4 py-2.5 font-bold text-slate-500 uppercase tracking-wider">Mã ao</th>
                    <th className="text-right px-4 py-2.5 font-bold text-slate-500 uppercase tracking-wider">Hao hụt</th>
                    <th className="text-right px-4 py-2.5 font-bold text-slate-500 uppercase tracking-wider">Thức ăn</th>
                    <th className="text-right px-4 py-2.5 font-bold text-slate-500 uppercase tracking-wider w-16">pH</th>
                    <th className="text-right px-4 py-2.5 font-bold text-slate-500 uppercase tracking-wider w-16">T°</th>
                    <th className="text-left px-4 py-2.5 font-bold text-slate-500 uppercase tracking-wider">Ghi chú / Thuốc</th>
                    <th className="px-4 py-2.5" />
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-50">
                  {displayLogs.map((log) => (
                    <tr
                      key={log.id}
                      className="hover:bg-slate-50/80 cursor-pointer group transition-colors"
                      onClick={() => {
                        setSelectedLog(log);
                        setShowLogDialog(false);
                      }}
                    >
                      <td className="px-4 py-2.5 text-slate-400 font-medium">{log.log_date}</td>
                      <td className="px-4 py-2.5 font-bold text-slate-700">{log.pond_code}</td>
                      <td className="px-4 py-2.5 text-right font-bold text-red-500">
                        {log.dead_fish > 0 ? `-${log.dead_fish}` : '—'}
                      </td>
                      <td className="px-4 py-2.5 text-right font-bold text-blue-600">
                        {log.feed_amount ? `${log.feed_amount}kg` : '—'}
                      </td>
                      <td className={`px-4 py-2.5 text-right font-medium ${log.ph && (log.ph < 6.5 || log.ph > 8.5) ? 'text-red-600' : 'text-slate-600'}`}>
                        {log.ph || '—'}
                      </td>
                      <td className={`px-4 py-2.5 text-right font-medium ${log.temperature && (log.temperature < 25 || log.temperature > 32) ? 'text-red-600' : 'text-slate-600'}`}>
                        {log.temperature || '—'}
                      </td>
                      <td className="px-4 py-2.5 text-slate-500 truncate max-w-[200px]">
                        {log.medicine_used ? `💊 ${log.medicine_used}` : log.notes || '—'}
                      </td>
                      <td className="px-4 py-2.5 text-right">
                        <div className="flex items-center justify-end gap-2">
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              setSelectedLog(log);
                              setShowLogDialog(true);
                            }}
                            className="w-6 h-6 rounded-full bg-slate-50 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity hover:bg-slate-100"
                            title="Sửa nhật ký"
                          >
                            <Edit className="w-3 h-3 text-slate-600" />
                          </button>
                          <div className="w-6 h-6 rounded-full bg-slate-50 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                            <ChevronRight className="w-3 h-3 text-slate-400" />
                          </div>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
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
      {showLogDialog && selectedPondForLog && !selectedLog && (
        <PondLogEditDialog
          open={showLogDialog}
          onClose={() => {
            setShowLogDialog(false);
            setSelectedPondForLog(null);
          }}
          log={{
            pond_id: selectedPondForLog.id,
            pond_code: selectedPondForLog.code,
            pond_cycle_id: pickActiveCycle(selectedPondForLog.pond_cycles)?.id,
            log_date: format(new Date(), 'yyyy-MM-dd'),
          }}
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
