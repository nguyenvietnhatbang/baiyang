import { useState, useEffect, useMemo } from 'react';
import { base44 } from '@/api/base44Client';
import { useAuth } from '@/lib/AuthContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Save, Plus } from 'lucide-react';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { formatSupabaseError } from '@/lib/supabaseErrors';
import { getWaterThresholdDefaults } from '@/lib/appSettingsHelpers';

export default function Settings() {
  const { user, refreshAppSettings, harvestAlertDays, appSettings } = useAuth();
  const w0 = getWaterThresholdDefaults(appSettings);

  const [days, setDays] = useState(String(harvestAlertDays));
  const [phMin, setPhMin] = useState(String(w0.ph_min));
  const [phMax, setPhMax] = useState(String(w0.ph_max));
  const [tempMin, setTempMin] = useState(String(w0.temp_min));
  const [tempMax, setTempMax] = useState(String(w0.temp_max));
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [ok, setOk] = useState(false);

  const [stockSeasons, setStockSeasons] = useState([]);
  const [stockBatches, setStockBatches] = useState([]);
  const [batchSeasonId, setBatchSeasonId] = useState('');
  const [batchCode, setBatchCode] = useState('');
  const [batchName, setBatchName] = useState('');
  const [batchRefDate, setBatchRefDate] = useState('');
  const [batchSaving, setBatchSaving] = useState(false);
  const [batchErr, setBatchErr] = useState('');
  const [batchOk, setBatchOk] = useState(false);

  const loadStockingData = () => {
    Promise.all([
      base44.entities.Season.filter({ active: true }, 'code', 100),
      base44.entities.StockingBatch.list('sort_order', 500),
    ]).then(([s, b]) => {
      setStockSeasons(s);
      setStockBatches(b);
    });
  };

  useEffect(() => {
    setDays(String(harvestAlertDays));
  }, [harvestAlertDays]);

  useEffect(() => {
    if (user?.role === 'admin') loadStockingData();
  }, [user?.role]);

  useEffect(() => {
    const w = getWaterThresholdDefaults(appSettings);
    setPhMin(String(w.ph_min));
    setPhMax(String(w.ph_max));
    setTempMin(String(w.temp_min));
    setTempMax(String(w.temp_max));
  }, [appSettings]);

  const batchesBySeason = useMemo(() => {
    const m = new Map();
    for (const b of stockBatches) {
      const arr = m.get(b.season_id) || [];
      arr.push(b);
      m.set(b.season_id, arr);
    }
    return m;
  }, [stockBatches]);

  const handleAddBatch = async () => {
    if (!batchSeasonId) {
      setBatchErr('Chọn vụ');
      return;
    }
    const code = batchCode.trim();
    const name = batchName.trim();
    if (!code || !name) {
      setBatchErr('Mã đợt và tên là bắt buộc');
      return;
    }
    setBatchErr('');
    setBatchOk(false);
    setBatchSaving(true);
    try {
      const n = stockBatches.filter((x) => x.season_id === batchSeasonId).length;
      await base44.entities.StockingBatch.create({
        season_id: batchSeasonId,
        code,
        name,
        stock_reference_date: batchRefDate || null,
        sort_order: n,
        active: true,
      });
      setBatchCode('');
      setBatchName('');
      setBatchRefDate('');
      setBatchOk(true);
      loadStockingData();
    } catch (e) {
      const msg = formatSupabaseError(e);
      if (msg.includes('stocking_batches') || msg.includes('does not exist')) {
        setBatchErr('Chưa có bảng đợt thả. Chạy scripts/migrations/20260426_stocking_batches.sql trên Supabase.');
      } else {
        setBatchErr(msg);
      }
    }
    setBatchSaving(false);
  };

  if (user?.role !== 'admin') {
    return (
      <div className="p-6 max-w-lg mx-auto">
        <p className="text-muted-foreground text-sm">Chỉ tài khoản admin mới xem được trang cài đặt hệ thống.</p>
      </div>
    );
  }

  const handleSave = async () => {
    const n = Number(days);
    if (!Number.isFinite(n) || n < 0 || n > 365) {
      setError('Nhập số ngày cảnh báo thu hoạch từ 0 đến 365');
      return;
    }
    const pLo = Number(phMin);
    const pHi = Number(phMax);
    const tLo = Number(tempMin);
    const tHi = Number(tempMax);
    if (![pLo, pHi, tLo, tHi].every((x) => Number.isFinite(x))) {
      setError('Ngưỡng pH và nhiệt độ phải là số');
      return;
    }
    if (pLo > pHi) {
      setError('pH tối thiểu không được lớn hơn pH tối đa');
      return;
    }
    if (tLo > tHi) {
      setError('Nhiệt độ tối thiểu không được lớn hơn nhiệt độ tối đa');
      return;
    }
    setError('');
    setOk(false);
    setSaving(true);
    try {
      await base44.entities.AppSettings.update({
        harvest_alert_days: Math.round(n),
        default_ph_min: pLo,
        default_ph_max: pHi,
        default_temp_min: tLo,
        default_temp_max: tHi,
      });
      await refreshAppSettings();
      setOk(true);
    } catch (e) {
      const msg = formatSupabaseError(e);
      if (msg.includes('column') && msg.includes('default_ph')) {
        setError(
          'CSDL chưa có cột ngưỡng nước. Chạy file scripts/migrations/20260426_app_settings_water_defaults.sql trên Supabase rồi thử lại.'
        );
      } else {
        setError(msg);
      }
    }
    setSaving(false);
  };

  return (
    <div className="p-6 max-w-2xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-foreground">Cài đặt hệ thống</h1>
        <p className="text-muted-foreground text-sm mt-0.5">
          Ngưỡng dùng chung: cảnh báo thu hoạch và giá trị mặc định khi tạo ao mới (pH, nhiệt độ).
        </p>
      </div>
      <div className="bg-card border border-border rounded-xl p-5 space-y-4 shadow-sm">
        {error && <p className="text-sm text-red-600 bg-red-50 border border-red-200 rounded px-3 py-2">{error}</p>}
        {ok && <p className="text-sm text-green-700 bg-green-50 border border-green-200 rounded px-3 py-2">Đã lưu.</p>}
        <div>
          <Label className="text-xs font-semibold text-muted-foreground uppercase">Cảnh báo thu hoạch (ngày)</Label>
          <p className="text-xs text-muted-foreground mt-0.5 mb-1">
            Ao có ngày thu dự kiến trong khoảng này được coi là &quot;Sắp thu&quot;
          </p>
          <Input type="number" min={0} max={365} value={days} onChange={(e) => setDays(e.target.value)} className="mt-1 w-32" />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <Label className="text-xs font-semibold text-muted-foreground uppercase">pH tối thiểu (mặc định)</Label>
            <Input type="number" step="0.1" value={phMin} onChange={(e) => setPhMin(e.target.value)} className="mt-1" />
          </div>
          <div>
            <Label className="text-xs font-semibold text-muted-foreground uppercase">pH tối đa (mặc định)</Label>
            <Input type="number" step="0.1" value={phMax} onChange={(e) => setPhMax(e.target.value)} className="mt-1" />
          </div>
          <div>
            <Label className="text-xs font-semibold text-muted-foreground uppercase">Nhiệt độ tối thiểu (°C)</Label>
            <Input type="number" step="0.1" value={tempMin} onChange={(e) => setTempMin(e.target.value)} className="mt-1" />
          </div>
          <div>
            <Label className="text-xs font-semibold text-muted-foreground uppercase">Nhiệt độ tối đa (°C)</Label>
            <Input type="number" step="0.1" value={tempMax} onChange={(e) => setTempMax(e.target.value)} className="mt-1" />
          </div>
        </div>
        <p className="text-xs text-muted-foreground">
          Các giá trị pH / nhiệt độ được gán khi tạo ao mới và khi nhân bản vụ; từng ao vẫn chỉnh riêng trong chi tiết ao.
        </p>
        <Button onClick={handleSave} disabled={saving} className="bg-primary text-white">
          <Save className="w-4 h-4 mr-2" />
          {saving ? 'Đang lưu...' : 'Lưu cài đặt'}
        </Button>
      </div>

      <div className="bg-card border border-border rounded-xl p-5 space-y-4 shadow-sm">
        <div>
          <h2 className="text-lg font-semibold text-foreground">Đợt thả cá (trong từng vụ)</h2>
          <p className="text-xs text-muted-foreground mt-0.5">
            Mỗi ao gán một đợt thả để lọc báo cáo và nhật ký. Vụ mới có sẵn đợt <strong>D1</strong> sau khi chạy migration; có thể thêm D2, L1… tại đây.
          </p>
        </div>
        {batchErr && (
          <p className="text-sm text-red-600 bg-red-50 border border-red-200 rounded px-3 py-2">{batchErr}</p>
        )}
        {batchOk && (
          <p className="text-sm text-green-700 bg-green-50 border border-green-200 rounded px-3 py-2">Đã thêm đợt thả.</p>
        )}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div className="sm:col-span-2">
            <Label className="text-xs font-semibold text-muted-foreground uppercase">Vụ *</Label>
            <Select value={batchSeasonId} onValueChange={setBatchSeasonId}>
              <SelectTrigger className="mt-1">
                <SelectValue placeholder="Chọn vụ" />
              </SelectTrigger>
              <SelectContent>
                {stockSeasons.map((s) => (
                  <SelectItem key={s.id} value={s.id}>{s.code} — {s.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label className="text-xs font-semibold text-muted-foreground uppercase">Mã đợt *</Label>
            <Input
              value={batchCode}
              onChange={(e) => setBatchCode(e.target.value)}
              placeholder="VD: D2, L1"
              className="mt-1 font-mono"
            />
          </div>
          <div>
            <Label className="text-xs font-semibold text-muted-foreground uppercase">Tên hiển thị *</Label>
            <Input
              value={batchName}
              onChange={(e) => setBatchName(e.target.value)}
              placeholder="VD: Đợt 2 — thả 15/03"
              className="mt-1"
            />
          </div>
          <div className="sm:col-span-2">
            <Label className="text-xs font-semibold text-muted-foreground uppercase">Ngày tham chiếu (tuỳ chọn)</Label>
            <Input type="date" value={batchRefDate} onChange={(e) => setBatchRefDate(e.target.value)} className="mt-1 w-48" />
          </div>
        </div>
        <Button onClick={handleAddBatch} disabled={batchSaving} className="bg-primary text-white">
          <Plus className="w-4 h-4 mr-2" />
          {batchSaving ? 'Đang thêm...' : 'Thêm đợt thả'}
        </Button>

        <div className="border-t border-border pt-4">
          <p className="text-xs font-semibold text-muted-foreground uppercase mb-2">Danh sách</p>
          <div className="rounded-lg border border-border divide-y divide-border max-h-64 overflow-y-auto text-sm">
            {stockSeasons.length === 0 ? (
              <p className="p-3 text-muted-foreground text-xs">Chưa có vụ.</p>
            ) : (
              stockSeasons.map((s) => {
                const rows = batchesBySeason.get(s.id) || [];
                return (
                  <div key={s.id} className="p-3 bg-muted/20">
                    <p className="font-semibold text-primary text-xs mb-1">{s.code} — {s.name}</p>
                    {rows.length === 0 ? (
                      <p className="text-xs text-muted-foreground">Chưa có đợt (chạy migration hoặc thêm ở trên).</p>
                    ) : (
                      <ul className="space-y-0.5 text-xs">
                        {rows.map((b) => (
                          <li key={b.id} className="flex justify-between gap-2">
                            <span>{b.code} — {b.name}</span>
                            {b.stock_reference_date && (
                              <span className="text-muted-foreground shrink-0">{b.stock_reference_date}</span>
                            )}
                          </li>
                        ))}
                      </ul>
                    )}
                  </div>
                );
              })
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
