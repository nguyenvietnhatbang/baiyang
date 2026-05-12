import { useState, useEffect, useMemo, useRef } from 'react';
import { base44 } from '@/api/base44Client';
import { Plus, Pencil, Trash2, AlertTriangle, Save, Upload, Eye, MoreVertical, Phone, MessageCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import HouseholdViewDialog from './HouseholdViewDialog';
import { formatSupabaseError } from '@/lib/supabaseErrors';
import ExcelJS from 'exceljs';
import { ChevronsUpDown } from 'lucide-react';

function SearchablePicker({
  label,
  value,
  onChange,
  options,
  placeholder = 'Chọn…',
  disabled,
}) {
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
  }, [open, rootRef]);

  const trimmed = search.trim().toLowerCase();
  const filtered = useMemo(() => {
    if (!trimmed) return options;
    return options.filter((o) => (o.searchText || o.label).toLowerCase().includes(trimmed));
  }, [options, trimmed]);

  const current = options.find((o) => String(o.value) === String(value)) || null;

  return (
    <div ref={rootRef} className="relative">
      {label ? <Label className="text-sm font-bold text-muted-foreground uppercase">{label}</Label> : null}
      <Button
        type="button"
        variant="outline"
        disabled={disabled}
        onClick={() => setOpen((v) => !v)}
        className={`mt-1 h-10 w-full justify-between px-2 font-semibold text-base ${!current ? 'text-muted-foreground' : ''}`}
      >
        <span className="truncate text-left">{current?.label || placeholder}</span>
        <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" aria-hidden />
      </Button>
      {open && (
        <div className="absolute left-0 top-[calc(100%+4px)] z-50 w-full min-w-[12rem] rounded-lg border border-border bg-popover shadow-md">
          <div className="p-2 border-b border-border">
            <Input
              autoFocus
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Tìm…"
              className="h-9 text-base font-semibold"
            />
          </div>
          <div className="max-h-64 overflow-y-auto p-1">
            {filtered.length === 0 ? (
              <div className="px-2 py-2 text-sm font-semibold text-muted-foreground">Không có kết quả</div>
            ) : (
              filtered.map((o) => (
                <button
                  key={String(o.value)}
                  type="button"
                  className={`flex w-full items-center rounded-md px-2 py-1.5 text-left text-base font-semibold hover:bg-accent hover:text-accent-foreground ${String(o.value) === String(value) ? 'bg-accent/60' : ''}`}
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

function normalizeSegment(s) {
  const t = (s || '').trim();
  if (!t) return '';
  const digits = t.replace(/\D/g, '');
  if (!digits) return '';
  return digits.padStart(3, '0').slice(-3);
}

function phoneDigits(p) {
  return String(p || '').replace(/\D/g, '');
}

function HouseholdDialog({ open, onClose, onSaved, row, agencies, regions, households = [] }) {
  const isEdit = !!row;
  const [form, setForm] = useState({
    agency_id: '',
    region_code: '17',
    household_segment: '',
    name: '',
    phone: '',
    address: '',
    active: true,
  });
  const [saving, setSaving] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (open) {
      setError('');
      setConfirmDelete(false);
      if (isEdit) {
        setForm({
          agency_id: row.agency_id,
          region_code: row.region_code || '17',
          household_segment: row.household_segment || '',
          name: row.name || '',
          phone: row.phone || '',
          address: row.address || '',
          active: row.active !== false,
        });
      } else {
        const firstAg = agencies[0];
        setForm({
          agency_id: firstAg?.id || '',
          region_code: firstAg?.region_code || regions[0]?.code || '17',
          household_segment: '',
          name: '',
          phone: '',
          address: '',
          active: true,
        });
      }
    }
  }, [open, isEdit, row, agencies, regions]);

  const segPreview = normalizeSegment(form.household_segment);
  const dup = households.some(
    (r) => r.agency_id === form.agency_id && r.household_segment === segPreview && (!isEdit || r.id !== row.id)
  );

  const handleSave = async () => {
    const seg = normalizeSegment(form.household_segment);
    if (!form.agency_id || !seg || !form.name.trim()) {
      setError('Đại lý, mã hộ (3 số) và tên hộ là bắt buộc');
      return;
    }
    if (dup) {
      setError(`Mã hộ "${seg}" đã tồn tại trong đại lý này`);
      return;
    }
    setError('');
    setSaving(true);
    try {
      const payload = {
        agency_id: form.agency_id,
        region_code: form.region_code,
        household_segment: seg,
        name: form.name.trim(),
        phone: form.phone?.trim() || null,
        address: form.address?.trim() || null,
        active: form.active,
      };
      if (isEdit) {
        await base44.entities.Household.update(row.id, payload);
      } else {
        await base44.entities.Household.create(payload);
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
    try {
      await base44.entities.Household.delete(row.id);
      onSaved();
      onClose();
    } catch (e) {
      setError(formatSupabaseError(e));
    }
    setDeleting(false);
  };

  const f = (key) => ({ value: form[key], onChange: (e) => setForm({ ...form, [key]: e.target.value }) });

  const agencySelectItems = useMemo(
    () =>
      agencies.map((a) => ({
        value: a.id,
        label: `${a.code} — ${a.name}`,
        searchText: `${a.code} ${a.name} ${a.region_code || ''}`,
      })),
    [agencies]
  );
  const regionSelectItems = useMemo(
    () =>
      regions.map((r) => ({
        value: r.code,
        label: `${r.code} — ${r.name}`,
        searchText: `${r.code} ${r.name}`,
      })),
    [regions]
  );
  const activeSelectItems = useMemo(
    () => [
      { value: '1', label: 'Hoạt động' },
      { value: '0', label: 'Tạm dừng' },
    ],
    []
  );

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{isEdit ? `Sửa hộ nuôi — ${row.name}` : 'Thêm hộ nuôi'}</DialogTitle>
        </DialogHeader>
        {!confirmDelete ? (
          <div className="space-y-4 py-2">
            {error && <p className="text-base font-semibold text-red-500 bg-red-50 border border-red-200 rounded px-3 py-2">{error}</p>}
            <div>
              <SearchablePicker
                label="Đại lý *"
                value={form.agency_id}
                onChange={(v) => {
                  const ag = agencies.find((a) => a.id === v);
                  setForm({
                    ...form,
                    agency_id: v,
                    region_code: ag?.region_code || form.region_code,
                  });
                }}
                options={agencySelectItems}
                placeholder="Chọn đại lý"
                disabled={agencies.length === 0}
              />
            </div>
            <div>
              <SearchablePicker
                label="Khu vực (mã) *"
                value={form.region_code}
                onChange={(v) => setForm({ ...form, region_code: v })}
                options={regionSelectItems}
                placeholder="Chọn khu vực"
                disabled={regions.length === 0}
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label className="text-sm font-bold text-muted-foreground uppercase">Mã hộ (001) *</Label>
                <Input
                  value={form.household_segment}
                  onChange={(e) => setForm({ ...form, household_segment: e.target.value })}
                  className="mt-1 font-mono"
                  placeholder="001"
                />
              </div>
              <div>
                <Label className="text-sm font-bold text-muted-foreground uppercase">Trạng thái</Label>
                <Select
                  value={form.active ? '1' : '0'}
                  onValueChange={(v) => setForm({ ...form, active: v === '1' })}
                  items={activeSelectItems}
                >
                  <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="1">Hoạt động</SelectItem>
                    <SelectItem value="0">Tạm dừng</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div>
              <Label className="text-sm font-bold text-muted-foreground uppercase">Tên hộ *</Label>
              <Input {...f('name')} className="mt-1" />
            </div>
            <div>
              <Label className="text-sm font-bold text-muted-foreground uppercase">SĐT</Label>
              <Input {...f('phone')} className="mt-1" placeholder="VD: 0912345678" inputMode="tel" />
            </div>
            <div>
              <Label className="text-sm font-bold text-muted-foreground uppercase">Địa chỉ</Label>
              <Input {...f('address')} className="mt-1" />
            </div>
            <div className="flex gap-2 pt-1">
              <Button onClick={handleSave} disabled={saving} className="flex-1 bg-primary text-white">
                <Save className="w-4 h-4 mr-1.5" />
                {saving ? 'Đang lưu...' : isEdit ? 'Lưu' : 'Tạo hộ'}
              </Button>
              {isEdit && (
                <Button variant="outline" className="border-red-200 text-red-600" onClick={() => setConfirmDelete(true)}>
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
                <p className="font-bold text-red-700 text-base">Xóa hộ {row.name}?</p>
                <p className="text-sm font-semibold text-red-600 mt-0.5">Các ao liên kết sẽ mất household_id nếu FK set null.</p>
              </div>
            </div>
            <div className="flex gap-2">
              <Button variant="outline" onClick={() => setConfirmDelete(false)} className="flex-1">Hủy</Button>
              <Button onClick={handleDelete} disabled={deleting} className="flex-1 bg-red-500 text-white">
                {deleting ? 'Đang xóa...' : 'Xóa'}
              </Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

/** Danh sách + dialog hộ nuôi — dùng trong trang Ao (tab) hoặc đứng riêng. */
export function HouseholdsPanel({ embedded = false }) {
  const [rows, setRows] = useState([]);
  const [agencies, setAgencies] = useState([]);
  const [regions, setRegions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [viewDialogOpen, setViewDialogOpen] = useState(false);
  const [editRow, setEditRow] = useState(null);
  const [viewRow, setViewRow] = useState(null);
  const [importing, setImporting] = useState(false);
  const [importMsg, setImportMsg] = useState('');

  const load = async () => {
    const [h, a, r] = await Promise.all([
      base44.entities.Household.list('-created_at', 500),
      base44.entities.Agency.list('code', 200),
      base44.entities.RegionCode.list('sort_order', 100),
    ]);
    setRows(h);
    setAgencies(a);
    setRegions(r.length ? r : [{ code: '17', name: 'Thái Bình' }]);
    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  const agencyMap = Object.fromEntries(agencies.map((a) => [a.id, a]));
  const regionMap = Object.fromEntries(regions.map((r) => [r.code, r]));

  const agencyCodeMap = useMemo(() => {
    const m = new Map();
    agencies.forEach((a) => {
      const raw = String(a.code || '').trim();
      const compact = raw.replace(/\s+/g, '').toUpperCase();
      const digits = compact.replace(/\D/g, '');
      if (raw) m.set(raw.toUpperCase(), a);
      if (compact) m.set(compact, a);
      if (digits) m.set(digits, a);
      if (digits) m.set(digits.padStart(2, '0'), a);
    });
    return m;
  }, [agencies]);

  const parseAgencyAndSegment = (rawCode) => {
    const txt = String(rawCode || '').trim();
    if (!txt) return null;
    const groups = txt.match(/\d+/g) || [];
    if (groups.length < 3) return null;
    const agencyCode = groups[1].padStart(2, '0');
    const segment = normalizeSegment(groups[2]);
    if (!segment) return null;
    return { agencyCode, segment };
  };

  const handleImportExcel = async (file) => {
    if (!file) return;
    setImportMsg('');
    setImporting(true);
    try {
      const buf = await file.arrayBuffer();
      const wb = new ExcelJS.Workbook();
      await wb.xlsx.load(buf);
      const ws = wb.worksheets[0];
      if (!ws) throw new Error('File Excel không có sheet dữ liệu.');

      const header = ws.getRow(1).values || [];
      const cells = Array.isArray(header) ? header : [];
      const normalized = cells.map((v) => String(v || '').trim().toLowerCase());
      let nameCol = normalized.findIndex((x) => x.includes('hộ nuôi'));
      let codeCol = normalized.findIndex((x) => x.includes('mã hộ'));
      if (nameCol <= 0) nameCol = 1;
      if (codeCol <= 0) codeCol = 2;

      const dedupInFile = new Set();
      const existing = new Set(rows.map((r) => `${r.agency_id}::${r.household_segment}`));
      let created = 0;
      let skipped = 0;
      const issues = [];

      for (let r = 2; r <= ws.rowCount; r += 1) {
        const row = ws.getRow(r);
        const name = String(row.getCell(nameCol).value || '').trim();
        const codeRaw = String(row.getCell(codeCol).value || '').trim();
        if (!name && !codeRaw) continue;

        const parsed = parseAgencyAndSegment(codeRaw);
        if (!parsed) {
          skipped += 1;
          issues.push(`Dòng ${r}: mã hộ không hợp lệ "${codeRaw}"`);
          continue;
        }

        const agency =
          agencyCodeMap.get(parsed.agencyCode) ||
          agencyCodeMap.get(parsed.agencyCode.replace(/^0+/, '')) ||
          null;
        if (!agency) {
          skipped += 1;
          issues.push(`Dòng ${r}: không tìm thấy đại lý mã ${parsed.agencyCode}`);
          continue;
        }

        const key = `${agency.id}::${parsed.segment}`;
        if (dedupInFile.has(key) || existing.has(key)) {
          skipped += 1;
          continue;
        }
        dedupInFile.add(key);

        await base44.entities.Household.create({
          agency_id: agency.id,
          region_code: agency.region_code || '17',
          household_segment: parsed.segment,
          name: name || `Hộ ${parsed.segment}`,
          address: null,
          active: true,
        });
        created += 1;
      }

      await load();
      const issueText = issues.slice(0, 3).join(' | ');
      setImportMsg(
        `Import xong: tạo ${created} hộ, bỏ qua ${skipped} dòng.` +
          (issueText ? ` Lỗi mẫu: ${issueText}${issues.length > 3 ? ' ...' : ''}` : '')
      );
    } catch (e) {
      setImportMsg(`Import thất bại: ${formatSupabaseError(e)}`);
    }
    setImporting(false);
  };

  return (
    <div className={embedded ? 'space-y-4 text-base font-semibold' : 'p-6 space-y-5 max-w-7xl mx-auto text-base font-semibold'}>
      <div className={`flex flex-col sm:flex-row sm:items-center gap-3 ${embedded ? 'sm:justify-end' : 'sm:justify-between'}`}>
        {!embedded && (
          <div>
            <h1 className="text-3xl font-extrabold text-foreground">Quản lý hộ nuôi</h1>
            <p className="text-muted-foreground text-base font-semibold mt-0.5">Mã hộ dùng trong mã ao (khu vực–đại lý–hộ–STT ao)</p>
          </div>
        )}
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            className="flex items-center gap-2 shrink-0 text-base font-bold h-10 px-4"
            disabled={agencies.length === 0 || importing}
            onClick={() => document.getElementById('household-import-excel')?.click()}
          >
            <Upload className="w-4 h-4" />
            {importing ? 'Đang import...' : 'Import Excel'}
          </Button>
          <input
            id="household-import-excel"
            type="file"
            accept=".xlsx,.xls"
            className="hidden"
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) void handleImportExcel(f);
              e.target.value = '';
            }}
          />
          <Button
            onClick={() => {
              setEditRow(null);
              setDialogOpen(true);
            }}
            className="bg-primary text-white flex items-center gap-2 shrink-0 text-base font-bold h-10 px-4"
            disabled={agencies.length === 0}
          >
            <Plus className="w-4 h-4" />
            Thêm hộ
          </Button>
        </div>
      </div>

      {importMsg && (
        <p className="text-sm font-semibold text-muted-foreground bg-muted/40 border border-border rounded-lg px-3 py-2">{importMsg}</p>
      )}

      {agencies.length === 0 && (
        <p className="text-base font-semibold text-amber-800 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2">
          Cần có ít nhất một đại lý trước khi tạo hộ nuôi.
        </p>
      )}

      <div className="bg-card border border-border rounded-xl overflow-hidden shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full text-base min-w-[700px]">
            <thead>
              <tr className="bg-muted/50 border-b border-border">
                <th className="text-left px-4 py-3.5 text-base font-extrabold text-muted-foreground uppercase whitespace-nowrap">Tên hộ</th>
                <th className="text-left px-4 py-3.5 text-base font-extrabold text-muted-foreground uppercase whitespace-nowrap">Mã hộ</th>
                <th className="text-left px-4 py-3.5 text-base font-extrabold text-muted-foreground uppercase whitespace-nowrap">Khu vực</th>
                <th className="text-left px-4 py-3.5 text-base font-extrabold text-muted-foreground uppercase whitespace-nowrap">Đại lý</th>
                <th className="text-left px-4 py-3.5 text-base font-extrabold text-muted-foreground uppercase whitespace-nowrap">SĐT</th>
                <th className="text-left px-4 py-3.5 text-base font-extrabold text-muted-foreground uppercase whitespace-nowrap">Địa chỉ</th>
                <th className="sticky right-0 bg-muted/50 text-center px-4 py-3.5 text-base font-extrabold text-muted-foreground uppercase whitespace-nowrap border-l border-border shadow-[-2px_0_4px_rgba(0,0,0,0.05)]">Thao tác</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {loading ? (
                <tr><td colSpan={7} className="px-4 py-8 text-center text-muted-foreground font-semibold">Đang tải...</td></tr>
              ) : rows.length === 0 ? (
                <tr><td colSpan={7} className="px-4 py-12 text-center text-muted-foreground font-semibold">Chưa có hộ nuôi</td></tr>
              ) : (
                rows.map((x) => (
                  <tr key={x.id} className="hover:bg-muted/20">
                    <td className="px-4 py-3.5 font-bold whitespace-nowrap">{x.name}</td>
                    <td className="px-4 py-3.5 font-mono text-primary font-bold whitespace-nowrap">{x.household_segment}</td>
                    <td className="px-4 py-3.5 font-semibold whitespace-nowrap">{x.region_code}</td>
                    <td className="px-4 py-3.5 text-muted-foreground font-semibold whitespace-nowrap">{agencyMap[x.agency_id]?.code || '—'}</td>
                    <td className="px-4 py-3.5 text-muted-foreground font-semibold whitespace-nowrap">{x.phone || '—'}</td>
                    <td className="px-4 py-3.5 text-muted-foreground text-base font-semibold max-w-[250px]">
                      <div className="truncate">{x.address || '—'}</div>
                    </td>
                    <td className="sticky right-0 bg-card px-4 py-3.5 whitespace-nowrap border-l border-border shadow-[-2px_0_4px_rgba(0,0,0,0.05)]">
                      <div className="flex items-center justify-center">
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="sm" className="h-8 w-8 p-0">
                              <MoreVertical className="w-4 h-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            {x.phone && (
                              <>
                                <DropdownMenuItem asChild>
                                  <a href={`tel:${phoneDigits(x.phone)}`} className="flex items-center">
                                    <Phone className="w-4 h-4 mr-2" />
                                    Gọi
                                  </a>
                                </DropdownMenuItem>
                                <DropdownMenuItem asChild>
                                  <a
                                    href={`https://zalo.me/${phoneDigits(x.phone)}`}
                                    target="_blank"
                                    rel="noreferrer"
                                    className="flex items-center"
                                  >
                                    <MessageCircle className="w-4 h-4 mr-2" />
                                    Zalo
                                  </a>
                                </DropdownMenuItem>
                              </>
                            )}
                            <DropdownMenuItem onClick={() => { setViewRow(x); setViewDialogOpen(true); }}>
                              <Eye className="w-4 h-4 mr-2" />
                              Xem
                            </DropdownMenuItem>
                            <DropdownMenuItem onClick={() => { setEditRow(x); setDialogOpen(true); }}>
                              <Pencil className="w-4 h-4 mr-2" />
                              Sửa
                            </DropdownMenuItem>
                            <DropdownMenuItem 
                              onClick={() => { setEditRow(x); setDialogOpen(true); }}
                              className="text-red-600"
                            >
                              <Trash2 className="w-4 h-4 mr-2" />
                              Xóa
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      <HouseholdDialog
        open={dialogOpen}
        onClose={() => { setDialogOpen(false); setEditRow(null); }}
        onSaved={load}
        row={editRow}
        agencies={agencies}
        regions={regions}
        households={rows}
      />

      <HouseholdViewDialog
        open={viewDialogOpen}
        onClose={() => { setViewDialogOpen(false); setViewRow(null); }}
        household={viewRow}
        agency={viewRow ? agencyMap[viewRow.agency_id] : null}
        region={viewRow ? regionMap[viewRow.region_code] : null}
      />
    </div>
  );
}
