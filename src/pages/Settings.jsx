import { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { useAuth } from '@/lib/AuthContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Save } from 'lucide-react';
import { formatSupabaseError } from '@/lib/supabaseErrors';
import { getFactoryPlanKgByMonth, getWaterThresholdDefaults } from '@/lib/appSettingsHelpers';

export default function Settings() {
  const { user, refreshAppSettings, harvestAlertDays, appSettings } = useAuth();
  const w0 = getWaterThresholdDefaults(appSettings);
  const fp0 = getFactoryPlanKgByMonth(appSettings);

  const [days, setDays] = useState(String(harvestAlertDays));
  const [phMin, setPhMin] = useState(String(w0.ph_min));
  const [phMax, setPhMax] = useState(String(w0.ph_max));
  const [tempMin, setTempMin] = useState(String(w0.temp_min));
  const [tempMax, setTempMax] = useState(String(w0.temp_max));
  const [doMin, setDoMin] = useState(String(w0.do_min));
  const [doMax, setDoMax] = useState(String(w0.do_max));
  const [nh3Min, setNh3Min] = useState(String(w0.nh3_min));
  const [nh3Max, setNh3Max] = useState(String(w0.nh3_max));
  const [no2Min, setNo2Min] = useState(String(w0.no2_min));
  const [no2Max, setNo2Max] = useState(String(w0.no2_max));
  const [h2sMin, setH2sMin] = useState(String(w0.h2s_min));
  const [h2sMax, setH2sMax] = useState(String(w0.h2s_max));
  const [factoryPlan, setFactoryPlan] = useState(fp0.map((x) => String(x ?? 0)));
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [ok, setOk] = useState(false);

  useEffect(() => {
    setDays(String(harvestAlertDays));
  }, [harvestAlertDays]);

  useEffect(() => {
    const w = getWaterThresholdDefaults(appSettings);
    setPhMin(String(w.ph_min));
    setPhMax(String(w.ph_max));
    setTempMin(String(w.temp_min));
    setTempMax(String(w.temp_max));
    setDoMin(String(w.do_min));
    setDoMax(String(w.do_max));
    setNh3Min(String(w.nh3_min));
    setNh3Max(String(w.nh3_max));
    setNo2Min(String(w.no2_min));
    setNo2Max(String(w.no2_max));
    setH2sMin(String(w.h2s_min));
    setH2sMax(String(w.h2s_max));
    setFactoryPlan(getFactoryPlanKgByMonth(appSettings).map((x) => String(x ?? 0)));
  }, [appSettings]);

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
    const dLo = Number(doMin);
    const dHi = Number(doMax);
    const nLo = Number(nh3Min);
    const nHi = Number(nh3Max);
    const n2Lo = Number(no2Min);
    const n2Hi = Number(no2Max);
    const hLo = Number(h2sMin);
    const hHi = Number(h2sMax);
    
    if (![pLo, pHi, tLo, tHi, dLo, dHi, nLo, nHi, n2Lo, n2Hi, hLo, hHi].every((x) => Number.isFinite(x))) {
      setError('Tất cả ngưỡng phải là số hợp lệ');
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
    if (dLo > dHi) {
      setError('DO tối thiểu không được lớn hơn DO tối đa');
      return;
    }
    if (nLo > nHi) {
      setError('NH3 tối thiểu không được lớn hơn NH3 tối đa');
      return;
    }
    if (n2Lo > n2Hi) {
      setError('NO2 tối thiểu không được lớn hơn NO2 tối đa');
      return;
    }
    if (hLo > hHi) {
      setError('H2S tối thiểu không được lớn hơn H2S tối đa');
      return;
    }

    const fp = factoryPlan.map((x) => {
      const v = Number(String(x || '').replace(/,/g, ''));
      return Number.isFinite(v) && v >= 0 ? Math.round(v) : 0;
    });
    if (fp.length !== 12) {
      setError('Kế hoạch nhà máy phải đủ 12 tháng (T1..T12).');
      return;
    }

    setError('');
    setOk(false);
    setSaving(true);
    try {
      await base44.entities.AppSettings.update({
        harvest_alert_days: Math.round(n),
        factory_plan_kg_by_month: fp,
        default_ph_min: pLo,
        default_ph_max: pHi,
        default_temp_min: tLo,
        default_temp_max: tHi,
        default_do_min: dLo,
        default_do_max: dHi,
        default_nh3_min: nLo,
        default_nh3_max: nHi,
        default_no2_min: n2Lo,
        default_no2_max: n2Hi,
        default_h2s_min: hLo,
        default_h2s_max: hHi,
      });
      await refreshAppSettings();
      setOk(true);
    } catch (e) {
      const msg = formatSupabaseError(e);
      if (msg.includes('column') && (msg.includes('default_ph') || msg.includes('default_do'))) {
        setError(
          'CSDL chưa có đầy đủ cột ngưỡng nước. Chạy file scripts/migrations/20260504_app_settings_full_water_thresholds.sql trên Supabase rồi thử lại.'
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
          Ngưỡng cảnh báo chất lượng nước và cảnh báo thu hoạch cho toàn hệ thống.
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

        <div className="border-t border-border pt-4">
          <h3 className="text-sm font-bold text-foreground mb-3">Kế hoạch nhà máy (kg/tháng)</h3>
          <p className="text-xs text-muted-foreground mb-3">
            Dùng để cảnh báo sản lượng thừa/thiếu theo tháng trong các báo cáo kế hoạch.
          </p>
          <div className="grid grid-cols-3 sm:grid-cols-4 gap-3">
            {Array.from({ length: 12 }, (_, i) => (
              <div key={i}>
                <Label className="text-xs font-semibold text-muted-foreground uppercase">{`T${i + 1} (kg)`}</Label>
                <Input
                  type="number"
                  min={0}
                  step="1"
                  value={factoryPlan[i] ?? '0'}
                  onChange={(e) => {
                    const v = e.target.value;
                    setFactoryPlan((prev) => {
                      const next = [...prev];
                      next[i] = v;
                      return next;
                    });
                  }}
                  className="mt-1"
                />
              </div>
            ))}
          </div>
        </div>

        <div className="border-t border-border pt-4">
          <h3 className="text-sm font-bold text-foreground mb-3">Ngưỡng chất lượng nước</h3>
          <p className="text-xs text-muted-foreground mb-3">
            Các giá trị này dùng để cảnh báo khi ghi nhật ký. Giá trị ngoài ngưỡng sẽ được đánh dấu đỏ.
          </p>
          
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label className="text-xs font-semibold text-muted-foreground uppercase">pH tối thiểu</Label>
              <Input type="number" step="0.1" value={phMin} onChange={(e) => setPhMin(e.target.value)} className="mt-1" />
            </div>
            <div>
              <Label className="text-xs font-semibold text-muted-foreground uppercase">pH tối đa</Label>
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

            <div>
              <Label className="text-xs font-semibold text-muted-foreground uppercase">DO tối thiểu (mg/L)</Label>
              <Input type="number" step="0.1" value={doMin} onChange={(e) => setDoMin(e.target.value)} className="mt-1" />
            </div>
            <div>
              <Label className="text-xs font-semibold text-muted-foreground uppercase">DO tối đa (mg/L)</Label>
              <Input type="number" step="0.1" value={doMax} onChange={(e) => setDoMax(e.target.value)} className="mt-1" />
            </div>

            <div>
              <Label className="text-xs font-semibold text-muted-foreground uppercase">NH3 tối thiểu (mg/L)</Label>
              <Input type="number" step="0.01" value={nh3Min} onChange={(e) => setNh3Min(e.target.value)} className="mt-1" />
            </div>
            <div>
              <Label className="text-xs font-semibold text-muted-foreground uppercase">NH3 tối đa (mg/L)</Label>
              <Input type="number" step="0.01" value={nh3Max} onChange={(e) => setNh3Max(e.target.value)} className="mt-1" />
            </div>

            <div>
              <Label className="text-xs font-semibold text-muted-foreground uppercase">NO2 tối thiểu (mg/L)</Label>
              <Input type="number" step="0.01" value={no2Min} onChange={(e) => setNo2Min(e.target.value)} className="mt-1" />
            </div>
            <div>
              <Label className="text-xs font-semibold text-muted-foreground uppercase">NO2 tối đa (mg/L)</Label>
              <Input type="number" step="0.01" value={no2Max} onChange={(e) => setNo2Max(e.target.value)} className="mt-1" />
            </div>

            <div>
              <Label className="text-xs font-semibold text-muted-foreground uppercase">H2S tối thiểu (mg/L)</Label>
              <Input type="number" step="0.01" value={h2sMin} onChange={(e) => setH2sMin(e.target.value)} className="mt-1" />
            </div>
            <div>
              <Label className="text-xs font-semibold text-muted-foreground uppercase">H2S tối đa (mg/L)</Label>
              <Input type="number" step="0.01" value={h2sMax} onChange={(e) => setH2sMax(e.target.value)} className="mt-1" />
            </div>
          </div>
        </div>

        <Button onClick={handleSave} disabled={saving} className="bg-primary text-white">
          <Save className="w-4 h-4 mr-2" />
          {saving ? 'Đang lưu...' : 'Lưu cài đặt'}
        </Button>
      </div>
    </div>
  );
}
