import { useEffect, useMemo, useState } from 'react';
import { base44 } from '@/api/base44Client';
import { useAuth } from '@/lib/AuthContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Save } from 'lucide-react';
import { formatSupabaseError } from '@/lib/supabaseErrors';
import { getFactoryPlanKgByMonth } from '@/lib/appSettingsHelpers';

const MONTHS = Array.from({ length: 12 }, (_, i) => `T${i + 1}`);

export default function FactoryPlan() {
  const { user, appSettings, refreshAppSettings } = useAuth();
  const canEdit = user?.role === 'admin';

  const initial = useMemo(() => getFactoryPlanKgByMonth(appSettings), [appSettings]);
  const [plan, setPlan] = useState(initial.map((x) => String(x ?? 0)));
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [ok, setOk] = useState(false);

  useEffect(() => {
    setPlan(getFactoryPlanKgByMonth(appSettings).map((x) => String(x ?? 0)));
  }, [appSettings]);

  const total = useMemo(
    () =>
      plan.reduce((s, x) => {
        const v = Number(String(x || '').replace(/,/g, ''));
        return s + (Number.isFinite(v) && v > 0 ? v : 0);
      }, 0),
    [plan]
  );

  const handleSave = async () => {
    if (!canEdit) return;
    const fp = plan.map((x) => {
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
      await base44.entities.AppSettings.update({ factory_plan_kg_by_month: fp });
      await refreshAppSettings();
      setOk(true);
    } catch (e) {
      setError(formatSupabaseError(e));
    }
    setSaving(false);
  };

  return (
    <div className="p-6 max-w-5xl mx-auto space-y-5">
      <div>
        <h1 className="text-2xl font-bold text-foreground">Kế hoạch nhà máy</h1>
        <p className="text-muted-foreground text-sm mt-0.5">
          Kế hoạch sản lượng theo tháng (kg). Dùng để cảnh báo thừa/thiếu trên các báo cáo kế hoạch.
        </p>
      </div>

      <div className="bg-card border border-border rounded-xl p-5 shadow-sm space-y-4">
        {error && <p className="text-sm text-red-600 bg-red-50 border border-red-200 rounded px-3 py-2">{error}</p>}
        {ok && <p className="text-sm text-green-700 bg-green-50 border border-green-200 rounded px-3 py-2">Đã lưu.</p>}

        {!canEdit && (
          <p className="text-xs text-muted-foreground">
            Bạn đang ở chế độ <strong>chỉ xem</strong>. Chỉ admin mới được sửa kế hoạch nhà máy.
          </p>
        )}

        <div className="overflow-x-auto">
          <table className="w-full text-sm border-collapse">
            <thead>
              <tr className="bg-muted/60 border-b border-border">
                <th className="text-left px-4 py-3 font-semibold text-muted-foreground uppercase tracking-wide whitespace-nowrap">Tháng</th>
                <th className="text-right px-4 py-3 font-semibold text-muted-foreground uppercase tracking-wide whitespace-nowrap">Kế hoạch (kg)</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {MONTHS.map((m, i) => (
                <tr key={m} className="hover:bg-muted/20">
                  <td className="px-4 py-3 font-semibold text-foreground whitespace-nowrap">{m}</td>
                  <td className="px-4 py-3">
                    <div className="flex items-center justify-end gap-2">
                      <Label className="sr-only">{`Kế hoạch ${m}`}</Label>
                      <Input
                        className="w-44 text-right"
                        type="number"
                        min={0}
                        step="1"
                        value={plan[i] ?? '0'}
                        onChange={(e) => {
                          const v = e.target.value;
                          setPlan((prev) => {
                            const next = [...prev];
                            next[i] = v;
                            return next;
                          });
                        }}
                        disabled={!canEdit || saving}
                      />
                    </div>
                  </td>
                </tr>
              ))}

              <tr className="bg-primary/5 font-bold border-t-2 border-primary/20">
                <td className="px-4 py-3 font-bold text-foreground">TỔNG NĂM</td>
                <td className="px-4 py-3 text-right font-bold text-foreground">{total > 0 ? Math.round(total).toLocaleString() : ''}</td>
              </tr>
            </tbody>
          </table>
        </div>

        {canEdit && (
          <Button onClick={handleSave} disabled={saving} className="bg-primary text-white">
            <Save className="w-4 h-4 mr-2" />
            {saving ? 'Đang lưu...' : 'Lưu kế hoạch'}
          </Button>
        )}
      </div>
    </div>
  );
}

