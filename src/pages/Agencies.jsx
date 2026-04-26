import { useState, useEffect, useMemo } from 'react';
import { base44 } from '@/api/base44Client';
import { Plus, Building2, Phone, MapPin, Home, Pencil, Trash2, AlertTriangle, Save } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { formatSupabaseError } from '@/lib/supabaseErrors';
import { VIETNAM_PROVINCE_OPTIONS, provinceNameByCode, provinceSortOrder } from '@/lib/vietnamProvinces';

const EMPTY_FORM = { code: '', name: '', phone: '', address: '', region: '', region_code: '', pond_code_segment: '01' };

function normalizeAgencyCode(code) {
  return (code || '').trim().toUpperCase().replace(/\s+/g, '');
}

function AgencyDialog({ open, onClose, onSaved, agency, existingCodes }) {
  const isEdit = !!agency;
  const [form, setForm] = useState(EMPTY_FORM);
  const [saving, setSaving] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState('');

  const provinceSelectItems = useMemo(
    () =>
      [...VIETNAM_PROVINCE_OPTIONS]
        .sort((a, b) => provinceSortOrder(a.code) - provinceSortOrder(b.code))
        .map((p) => ({ value: p.code, label: `${p.code} — ${p.name}` })),
    []
  );

  useEffect(() => {
    if (open) {
      setForm(isEdit ? {
        code: agency.code,
        name: agency.name,
        phone: agency.phone || '',
        address: agency.address || '',
        region: agency.region || provinceNameByCode(agency.region_code) || '',
        region_code: agency.region_code || '',
        pond_code_segment: agency.pond_code_segment || '01',
      } : { ...EMPTY_FORM });
      setConfirmDelete(false);
      setError('');
    }
  }, [open, isEdit, agency]);

  const handleSave = async () => {
    if (!form.code || !form.name) {
      setError('Mã và tên đại lý là bắt buộc');
      return;
    }
    if (!form.region_code) {
      setError('Chọn tỉnh / thành phố (mã dùng cho mã ao khi tạo hộ)');
      return;
    }
    const codeNorm = normalizeAgencyCode(form.code);
    const seg = (form.pond_code_segment || '01').trim().replace(/\s+/g, '') || '01';
    const isDuplicateCode = existingCodes.some(
      c => c.toLowerCase() === codeNorm.toLowerCase() && (!isEdit || c.toLowerCase() !== agency.code.toLowerCase())
    );
    if (isDuplicateCode) {
      setError(`Mã "${codeNorm}" đã tồn tại. Vui lòng chọn mã khác.`);
      return;
    }
    setError('');
    setSaving(true);
    try {
      const payload = {
        ...form,
        code: codeNorm,
        pond_code_segment: seg,
      };
      if (isEdit) {
        await base44.entities.Agency.update(agency.id, payload);
      } else {
        await base44.entities.Agency.create({ ...payload, active: true });
      }
      onSaved();
      onClose();
    } catch (e) {
      setError(formatSupabaseError(e));
    }
    setSaving(false);
  };

  const handleDelete = async () => {
    setDeleting(true);
    await base44.entities.Agency.delete(agency.id);
    onSaved();
    onClose();
    setDeleting(false);
  };

  const f = (key) => ({ value: form[key], onChange: e => setForm({ ...form, [key]: e.target.value }) });

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{isEdit ? `Chỉnh sửa — ${agency.code}` : 'Thêm đại lý mới'}</DialogTitle>
        </DialogHeader>

        {!confirmDelete ? (
          <div className="space-y-4 py-2">
            {error && <p className="text-sm text-red-500 bg-red-50 border border-red-200 rounded px-3 py-2">{error}</p>}
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label className="text-xs font-semibold text-muted-foreground uppercase">Mã đại lý *</Label>
                <Input {...f('code')} className="mt-1 font-mono uppercase" placeholder="VD: DL-01" />
                <p className="text-[10px] text-muted-foreground mt-0.5">Tự trim &amp; IN HOA khi lưu</p>
              </div>
              <div>
                <Label className="text-xs font-semibold text-muted-foreground uppercase">Phần mã trong mã ao</Label>
                <Input {...f('pond_code_segment')} className="mt-1 font-mono" placeholder="01" />
              </div>
            </div>
            <div>
              <Label className="text-xs font-semibold text-muted-foreground uppercase">Tỉnh / thành phố *</Label>
              <Select
                value={form.region_code}
                onValueChange={(v) =>
                  setForm({ ...form, region_code: v, region: provinceNameByCode(v) })
                }
                items={provinceSelectItems}
              >
                <SelectTrigger className="mt-1">
                  <SelectValue placeholder="Chọn tỉnh, thành phố…" />
                </SelectTrigger>
                <SelectContent className="max-h-72">
                  {VIETNAM_PROVINCE_OPTIONS.slice()
                    .sort((a, b) => provinceSortOrder(a.code) - provinceSortOrder(b.code))
                    .map((p) => (
                      <SelectItem key={p.code} value={p.code}>{p.code} — {p.name}</SelectItem>
                    ))}
                </SelectContent>
              </Select>
              <p className="text-[10px] text-muted-foreground mt-0.5">
                Mã tỉnh lưu trong hệ thống; khi tạo hộ nuôi sẽ gợi ý đúng mã để sinh mã ao (vd. 17-01-001-01).
              </p>
            </div>
            <div>
              <Label className="text-xs font-semibold text-muted-foreground uppercase">Tên người phụ trách *</Label>
              <Input {...f('name')} className="mt-1" placeholder="VD: Mr. Kết" />
            </div>
            <div>
              <Label className="text-xs font-semibold text-muted-foreground uppercase">Số điện thoại</Label>
              <Input {...f('phone')} className="mt-1" />
            </div>
            <div>
              <Label className="text-xs font-semibold text-muted-foreground uppercase">Địa chỉ</Label>
              <Input {...f('address')} className="mt-1" />
            </div>
            <div className="flex gap-2 pt-1">
              <Button onClick={handleSave} disabled={saving} className="flex-1 bg-primary text-white">
                <Save className="w-4 h-4 mr-1.5" />
                {saving ? 'Đang lưu...' : isEdit ? 'Lưu thay đổi' : 'Tạo đại lý'}
              </Button>
              {isEdit && (
                <Button variant="outline" className="border-red-200 text-red-600 hover:bg-red-50" onClick={() => setConfirmDelete(true)}>
                  <Trash2 className="w-4 h-4" />
                </Button>
              )}
            </div>
          </div>
        ) : (
          <div className="py-4 space-y-4">
            <div className="flex items-center gap-3 p-4 bg-red-50 border border-red-200 rounded-lg">
              <AlertTriangle className="w-5 h-5 text-red-500 flex-shrink-0" />
              <div>
                <p className="font-semibold text-red-700 text-sm">Xóa đại lý {agency.code}?</p>
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

export default function Agencies() {
  const [agencies, setAgencies] = useState([]);
  const [ponds, setPonds] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showDialog, setShowDialog] = useState(false);
  const [editAgency, setEditAgency] = useState(null);

  const loadData = async () => {
    const [a, p] = await Promise.all([
      base44.entities.Agency.list('-created_date', 100),
      base44.entities.Pond.list('-updated_date', 500),
    ]);
    setAgencies(a);
    setPonds(p);
    setLoading(false);
  };

  useEffect(() => { loadData(); }, []);

  const existingCodes = agencies.map(a => a.code);
  const handleEdit = (agency) => { setEditAgency(agency); setShowDialog(true); };
  const handleNew = () => { setEditAgency(null); setShowDialog(true); };
  const handleClose = () => { setShowDialog(false); setEditAgency(null); };

  return (
    <div className="p-6 space-y-5 max-w-7xl mx-auto">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Quản lý đại lý</h1>
          <p className="text-muted-foreground text-sm mt-0.5">{agencies.length} đại lý đang hoạt động</p>
        </div>
        <Button onClick={handleNew} className="bg-primary text-white flex items-center gap-2">
          <Plus className="w-4 h-4" />
          Thêm đại lý
        </Button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {loading ? (
          Array(3).fill(0).map((_, i) => (
            <div key={i} className="bg-card border border-border rounded-xl p-5 animate-pulse">
              <div className="h-5 bg-muted rounded w-2/3 mb-3" />
              <div className="h-4 bg-muted rounded w-1/2 mb-2" />
              <div className="h-4 bg-muted rounded w-3/4" />
            </div>
          ))
        ) : agencies.length === 0 ? (
          <div className="col-span-3 text-center py-16">
            <Building2 className="w-12 h-12 text-muted-foreground mx-auto mb-3" />
            <p className="text-muted-foreground">Chưa có đại lý nào</p>
          </div>
        ) : agencies.map(agency => {
          const agPonds = ponds.filter(p => p.agency_code === agency.code);
          const ccPonds = agPonds.filter(p => p.status === 'CC');
          const totalYield = agPonds.reduce((s, p) => s + (p.expected_yield || 0), 0);
          return (
            <div key={agency.id} className="bg-card border border-border rounded-xl p-5 shadow-sm hover:shadow-md transition-shadow">
              <div className="flex items-start justify-between mb-3">
                <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center">
                  <Building2 className="w-5 h-5 text-primary" />
                </div>
                <div className="flex items-center gap-2">
                  <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${agency.active ? 'bg-green-100 text-green-700' : 'bg-muted text-muted-foreground'}`}>
                    {agency.active ? 'Hoạt động' : 'Dừng'}
                  </span>
                  <button onClick={() => handleEdit(agency)} className="p-1.5 rounded-lg hover:bg-muted text-muted-foreground hover:text-foreground transition-colors" title="Sửa / Xóa">
                    <Pencil className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
              <h3 className="font-bold text-foreground">{agency.name}</h3>
              <p className="text-xs text-primary font-mono mt-0.5">{agency.code}</p>
              {agency.phone && <p className="text-xs text-muted-foreground flex items-center gap-1 mt-2"><Phone className="w-3 h-3" />{agency.phone}</p>}
              {(agency.region_code || agency.region) && (
                <p className="text-xs text-muted-foreground flex items-center gap-1 mt-1">
                  <MapPin className="w-3 h-3 flex-shrink-0" />
                  {agency.region_code
                    ? `${provinceNameByCode(agency.region_code) || agency.region} (${agency.region_code})`
                    : agency.region}
                </p>
              )}
              {agency.address && <p className="text-xs text-muted-foreground flex items-center gap-1 mt-1"><Home className="w-3 h-3 opacity-70 flex-shrink-0" />{agency.address}</p>}
              <div className="mt-4 pt-3 border-t border-border grid grid-cols-3 gap-2 text-center">
                <div><p className="text-lg font-bold text-foreground">{agPonds.length}</p><p className="text-xs text-muted-foreground">Tổng ao</p></div>
                <div><p className="text-lg font-bold text-blue-600">{ccPonds.length}</p><p className="text-xs text-muted-foreground">Đang CC</p></div>
                <div><p className="text-lg font-bold text-green-600">{(totalYield / 1000).toFixed(1)}T</p><p className="text-xs text-muted-foreground">DK sản lượng</p></div>
              </div>
            </div>
          );
        })}
      </div>

      <AgencyDialog open={showDialog} onClose={handleClose} onSaved={loadData} agency={editAgency} existingCodes={existingCodes} />
    </div>
  );
}