import { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { useAuth } from '@/lib/AuthContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Save } from 'lucide-react';
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

  useEffect(() => {
    setDays(String(harvestAlertDays));
  }, [harvestAlertDays]);

  useEffect(() => {
    const w = getWaterThresholdDefaults(appSettings);
    setPhMin(String(w.ph_min));
    setPhMax(String(w.ph_max));
    setTempMin(String(w.temp_min));
    setTempMax(String(w.temp_max));
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
          Các giá trị pH / nhiệt độ được gán khi tạo ao mới; từng ao vẫn chỉnh riêng trong trang chi tiết ao.
        </p>
        <Button onClick={handleSave} disabled={saving} className="bg-primary text-white">
          <Save className="w-4 h-4 mr-2" />
          {saving ? 'Đang lưu...' : 'Lưu cài đặt'}
        </Button>
      </div>
    </div>
  );
}
