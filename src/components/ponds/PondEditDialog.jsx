import { useState, useEffect, useMemo } from 'react';
import { base44 } from '@/api/base44Client';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Trash2, Save, AlertTriangle } from 'lucide-react';
import { formatSupabaseError } from '@/lib/supabaseErrors';

export default function PondEditDialog({ pond, open, onClose, onSaved, onDeleted, canEditCode = false }) {
  const [agencies, setAgencies] = useState([]);
  const [households, setHouseholds] = useState([]);
  const [form, setForm] = useState({
    code: '',
    household_id: '',
    area: '',
    depth: '',
    location: '',
    agency_code: '',
  });
  const [saving, setSaving] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (open) {
      base44.entities.Agency.list('code', 200).then(setAgencies);
      base44.entities.Household.filter({ active: true }, 'name', 500).then(setHouseholds);
      setForm({
        code: pond.code || '',
        household_id: pond.household_id || '',
        area: pond.area || '',
        depth: pond.depth || '',
        location: pond.location || '',
        agency_code: pond.agency_code || '',
      });
      setConfirmDelete(false);
      setError('');
    }
  }, [open, pond]);

  const selectedHousehold = households.find((h) => h.id === form.household_id);
  const agencyForHousehold = agencies.find((a) => a.id === selectedHousehold?.agency_id);

  const handleSave = async () => {
    if (!form.code?.trim()) {
      setError('Mã ao là bắt buộc');
      return;
    }
    if (!form.household_id) {
      setError('Chọn hộ nuôi');
      return;
    }
    setError('');
    setSaving(true);
    try {
      const ownerName = selectedHousehold?.name || '';
      const agencyCode = agencyForHousehold?.code || form.agency_code || null;
      await base44.entities.Pond.update(pond.id, {
        code: form.code.trim(),
        household_id: form.household_id,
        owner_name: ownerName,
        agency_code: agencyCode,
        area: Number(form.area) || null,
        depth: Number(form.depth) || null,
        location: form.location?.trim() || null,
      });
      onSaved();
      onClose();
    } catch (e) {
      setError(formatSupabaseError(e));
    }
    setSaving(false);
  };

  const handleDelete = async () => {
    setDeleting(true);
    try {
      await base44.entities.Pond.delete(pond.id);
      onDeleted();
      onClose();
    } catch (e) {
      setError(formatSupabaseError(e));
    }
    setDeleting(false);
  };

  const f = (key) => ({ value: form[key], onChange: (e) => setForm({ ...form, [key]: e.target.value }) });

  const householdSelectItems = useMemo(
    () => [
      { value: '__none__', label: '— Chọn —' },
      ...households.map((h) => ({ value: h.id, label: `${h.name} — ${h.household_segment}` })),
    ],
    [households]
  );

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Chỉnh sửa ao — {pond.code}</DialogTitle>
        </DialogHeader>

        {!confirmDelete ? (
          <div className="space-y-4 py-2">
            {error && <p className="text-sm text-red-500 bg-red-50 border border-red-200 rounded px-3 py-2">{error}</p>}
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label className="text-xs font-semibold text-muted-foreground uppercase">Mã ao *</Label>
                <Input {...f('code')} readOnly={!canEditCode} className={`mt-1 font-mono ${!canEditCode ? 'bg-muted/50' : ''}`} />
                {!canEditCode && <p className="text-[10px] text-muted-foreground mt-0.5">Chỉ admin đổi mã (cần kiểm soát QR / truy vết)</p>}
              </div>
              <div>
                <Label className="text-xs font-semibold text-muted-foreground uppercase">Đại lý (theo hộ)</Label>
                <Input value={agencyForHousehold?.code || form.agency_code || '—'} readOnly className="mt-1 bg-muted/50" />
              </div>
            </div>
            <div>
              <Label className="text-xs font-semibold text-muted-foreground uppercase">Hộ nuôi *</Label>
              <Select
                value={form.household_id || '__none__'}
                onValueChange={(v) => setForm({ ...form, household_id: v === '__none__' ? '' : v })}
                items={householdSelectItems}
              >
                <SelectTrigger className="mt-1">
                  <SelectValue placeholder="Chọn hộ..." />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="__none__">— Chọn —</SelectItem>
                  {households.map((h) => (
                    <SelectItem key={h.id} value={h.id}>{h.name} — {h.household_segment}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <p className="text-[11px] text-muted-foreground">
              Tên chu kỳ và kế hoạch thả: trang chi tiết ao → tab <strong>Kế hoạch</strong>.
            </p>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label className="text-xs font-semibold text-muted-foreground uppercase">Diện tích (m²)</Label>
                <Input type="number" {...f('area')} className="mt-1" />
              </div>
              <div>
                <Label className="text-xs font-semibold text-muted-foreground uppercase">Độ sâu (m)</Label>
                <Input type="number" step="0.1" {...f('depth')} className="mt-1" />
              </div>
            </div>
            <div>
              <Label className="text-xs font-semibold text-muted-foreground uppercase">Địa điểm</Label>
              <Input {...f('location')} className="mt-1" placeholder="Ấp, xã, huyện..." />
            </div>
            <div className="flex gap-2 pt-2">
              <Button onClick={handleSave} disabled={saving} className="flex-1 bg-primary text-white">
                <Save className="w-4 h-4 mr-1.5" />
                {saving ? 'Đang lưu...' : 'Lưu thay đổi'}
              </Button>
              <Button variant="outline" className="border-red-200 text-red-600 hover:bg-red-50" onClick={() => setConfirmDelete(true)}>
                <Trash2 className="w-4 h-4" />
              </Button>
            </div>
          </div>
        ) : (
          <div className="py-4 space-y-4">
            <div className="flex items-center gap-3 p-4 bg-red-50 border border-red-200 rounded-lg">
              <AlertTriangle className="w-5 h-5 text-red-500 flex-shrink-0" />
              <div>
                <p className="font-semibold text-red-700 text-sm">Xóa ao {pond.code}?</p>
                <p className="text-xs text-red-600 mt-0.5">Hành động này không thể hoàn tác.</p>
              </div>
            </div>
            <div className="flex gap-2">
              <Button variant="outline" onClick={() => setConfirmDelete(false)} className="flex-1">Hủy</Button>
              <Button onClick={handleDelete} disabled={deleting} className="flex-1 bg-red-500 hover:bg-red-600 text-white">
                <Trash2 className="w-4 h-4 mr-1.5" />
                {deleting ? 'Đang xóa...' : 'Xác nhận xóa'}
              </Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
