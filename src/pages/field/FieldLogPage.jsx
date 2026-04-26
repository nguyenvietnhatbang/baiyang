import { useEffect, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { format } from 'date-fns';
import { base44 } from '@/api/base44Client';
import { submitPondLogEntry } from '@/lib/pondLogSubmit';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { toast } from 'sonner';
import { ChevronLeft } from 'lucide-react';

const emptyForm = () => ({
  log_date: format(new Date(), 'yyyy-MM-dd'),
  ph: '',
  temperature: '',
  do: '',
  feed_amount: '',
  dead_fish: 0,
  notes: '',
});

export default function FieldLogPage() {
  const [params] = useSearchParams();
  const pondId = params.get('pond');

  const [pond, setPond] = useState(null);
  const [form, setForm] = useState(emptyForm);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!pondId) {
      setLoading(false);
      setPond(null);
      return;
    }
    let cancelled = false;
    base44.entities.Pond.filter({ id: pondId }, '-updated_at', 1)
      .then((rows) => {
        if (!cancelled) setPond(rows[0] || null);
      })
      .catch(() => {
        if (!cancelled) toast.error('Không tải được ao');
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [pondId]);

  const handleSave = async (e) => {
    e.preventDefault();
    if (!pond) return;
    if (!form.log_date) {
      toast.error('Chọn ngày');
      return;
    }
    setSaving(true);
    try {
      await submitPondLogEntry({
        pond,
        form: {
          ...form,
          nh3: '',
          no2: '',
          h2s: '',
          water_color: '',
          feed_code: '',
          medicine_used: '',
          medicine_dosage: '',
          withdrawal_days: '',
          disease_notes: '',
          avg_weight: '',
        },
      });
      toast.success('Đã lưu nhật ký');
      const rows = await base44.entities.Pond.filter({ id: pond.id }, '-updated_at', 1);
      if (rows[0]) setPond(rows[0]);
      setForm((f) => ({ ...emptyForm(), log_date: f.log_date }));
    } catch (err) {
      toast.error(err?.message || 'Không lưu được');
    }
    setSaving(false);
  };

  if (!pondId) {
    return (
      <div className="text-center py-14 space-y-4 px-2">
        <p className="text-stone-800 text-base leading-relaxed">Chọn ao ở trang chủ hoặc quét mã QR trên ao.</p>
        <Button asChild variant="outline" className="h-12 text-base border-stone-300">
          <Link to="/field">Về trang chủ</Link>
        </Button>
      </div>
    );
  }

  if (loading) {
    return <p className="text-center text-stone-800 py-14 text-base font-medium">Đang tải thông tin ao…</p>;
  }

  if (!pond) {
    return (
      <div className="text-center py-14 space-y-4 px-2">
        <p className="text-stone-800 text-base">Không tìm thấy ao hoặc bạn chưa được phép xem.</p>
        <Button asChild variant="outline" className="h-12 text-base border-stone-300">
          <Link to="/field">Về trang chủ</Link>
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-5 pb-8">
      <Link
        to="/field"
        className="inline-flex items-center gap-0.5 text-base font-semibold text-teal-800 hover:text-teal-950"
      >
        <ChevronLeft className="w-5 h-5" />
        Trang chủ
      </Link>

      <div className="rounded-2xl border border-stone-200 bg-white p-4 shadow-sm">
        <p className="text-xs font-bold text-stone-600 uppercase tracking-wide">Đang nhập nhật ký cho</p>
        <p className="text-xl font-bold text-stone-950 mt-1">{pond.code}</p>
        <p className="text-sm text-stone-800 mt-0.5">{pond.owner_name || '—'}</p>
      </div>

      <form onSubmit={handleSave} className="space-y-4">
        <div>
          <Label className="text-stone-800 text-sm font-semibold">Ngày ghi</Label>
          <Input
            type="date"
            required
            value={form.log_date}
            onChange={(e) => setForm({ ...form, log_date: e.target.value })}
            className="mt-1.5 h-14 text-base border-stone-300 bg-white text-stone-900"
          />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <Label className="text-stone-800 text-sm font-semibold">pH</Label>
            <Input
              type="number"
              step="0.01"
              inputMode="decimal"
              value={form.ph}
              onChange={(e) => setForm({ ...form, ph: e.target.value })}
              className="mt-1.5 h-14 text-base border-stone-300 bg-white text-stone-900"
              placeholder="—"
            />
          </div>
          <div>
            <Label className="text-stone-800 text-sm font-semibold">Nhiệt độ °C</Label>
            <Input
              type="number"
              step="0.1"
              inputMode="decimal"
              value={form.temperature}
              onChange={(e) => setForm({ ...form, temperature: e.target.value })}
              className="mt-1.5 h-14 text-base border-stone-300 bg-white text-stone-900"
              placeholder="—"
            />
          </div>
        </div>
        <div>
          <Label className="text-stone-800 text-sm font-semibold">DO (mg/L)</Label>
          <Input
            type="number"
            step="0.01"
            inputMode="decimal"
            value={form.do}
            onChange={(e) => setForm({ ...form, do: e.target.value })}
            className="mt-1.5 h-14 text-base border-stone-300 bg-white text-stone-900"
            placeholder="—"
          />
        </div>
        <div>
          <Label className="text-stone-800 text-sm font-semibold">Thức ăn (kg)</Label>
          <Input
            type="number"
            step="0.01"
            inputMode="decimal"
            value={form.feed_amount}
            onChange={(e) => setForm({ ...form, feed_amount: e.target.value })}
            className="mt-1.5 h-14 text-base border-stone-300 bg-white text-stone-900"
            placeholder="—"
          />
        </div>
        <div>
          <Label className="text-stone-800 text-sm font-semibold">Cá chết (con)</Label>
          <Input
            type="number"
            inputMode="numeric"
            value={form.dead_fish}
            onChange={(e) => setForm({ ...form, dead_fish: e.target.value })}
            className="mt-1.5 h-14 text-base border-stone-300 bg-white text-stone-900"
          />
        </div>
        <div>
          <Label className="text-stone-800 text-sm font-semibold">Ghi chú thêm</Label>
          <Textarea
            value={form.notes}
            onChange={(e) => setForm({ ...form, notes: e.target.value })}
            rows={4}
            className="mt-1.5 text-base border-stone-300 bg-white text-stone-900 min-h-[6rem] resize-y"
            placeholder="Ví dụ: nước trong, cá ăn tốt…"
          />
        </div>

        <Button
          type="submit"
          disabled={saving}
          className="w-full h-14 text-lg font-bold bg-teal-600 hover:bg-teal-700 text-white shadow-md"
        >
          {saving ? 'Đang lưu…' : 'Lưu nhật ký'}
        </Button>
      </form>
    </div>
  );
}
