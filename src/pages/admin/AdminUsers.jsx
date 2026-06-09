import { useEffect, useMemo, useRef, useState } from 'react';
import { base44 } from '@/api/base44Client';
import { normalizeVnPhone, FIELD_ROLE_LABELS } from '@/lib/fieldAuthHelpers';
import { Checkbox } from '@/components/ui/checkbox';
import { formatHouseholdSegmentDisplay } from '@/lib/householdSegment';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { toast } from 'sonner';
import { UserPlus, Plus, Eye, Edit, Trash2, MoreHorizontal } from 'lucide-react';
import { ExportExcelButton } from '@/components/ui/ExportExcelButton';

const ROLE_SELECT_ITEMS = [
  { value: 'agency', label: 'Đại lý' },
  { value: 'household_owner', label: 'Chủ hộ' },
  { value: 'manager', label: 'Giám sát vùng' },
];

const OFFICE_ROLE_LABELS = {
  admin: 'Quản trị',
  agency: 'Đại lý',
  household_owner: 'Chủ hộ',
};

function normalizeFieldAccountRow(row) {
  return {
    ...row,
    region_codes: Array.isArray(row?.region_codes) ? row.region_codes : [],
  };
}

function roleBadgeClass(role) {
  if (role === 'agency') return 'bg-blue-100 text-blue-700';
  if (role === 'manager') return 'bg-violet-100 text-violet-700';
  return 'bg-green-100 text-green-700';
}

function RegionCheckboxGroup({ regions, value, onChange }) {
  const selected = useMemo(() => new Set((value || []).map(String)), [value]);
  const toggle = (code) => {
    const next = new Set(selected);
    if (next.has(code)) next.delete(code);
    else next.add(code);
    onChange([...next].sort((a, b) => a.localeCompare(b, 'vi', { numeric: true })));
  };

  return (
    <div className="mt-1 max-h-52 overflow-y-auto rounded-lg border border-border p-2 space-y-1">
      {regions.length === 0 ? (
        <p className="px-2 py-2 text-xs text-muted-foreground">Chưa có danh mục khu vực</p>
      ) : (
        regions.map((r) => {
          const code = String(r.code);
          const checked = selected.has(code);
          return (
            <label
              key={code}
              className="flex items-center gap-2 rounded-md px-2 py-1.5 hover:bg-muted/50 cursor-pointer"
            >
              <Checkbox checked={checked} onCheckedChange={() => toggle(code)} />
              <span className="text-sm font-semibold">
                <span className="font-mono text-muted-foreground">{code}</span>
                {' — '}
                {r.name}
              </span>
            </label>
          );
        })
      )}
    </div>
  );
}

function SearchSelect({ value, onChange, options, placeholder = 'Chọn…' }) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState('');
  const rootRef = useRef(null);

  useEffect(() => {
    if (!open) setSearch('');
  }, [open]);

  useEffect(() => {
    if (!open) return undefined;
    const onPointerDown = (e) => {
      const root = rootRef.current;
      if (!root) return;
      if (!root.contains(e.target)) setOpen(false);
    };
    document.addEventListener('pointerdown', onPointerDown);
    return () => document.removeEventListener('pointerdown', onPointerDown);
  }, [open]);

  const q = search.trim().toLowerCase();
  const filtered = useMemo(() => {
    if (!q) return options;
    return options.filter((o) => {
      const hay = String(o.searchText ?? o.label ?? '').toLowerCase();
      return hay.includes(q);
    });
  }, [options, q]);

  const cur = options.find((o) => String(o.value) === String(value)) || null;

  return (
    <div ref={rootRef} className="relative">
      <Button
        type="button"
        variant="outline"
        onClick={() => setOpen((v) => !v)}
        className={`mt-1 h-10 w-full justify-between px-2 text-sm font-semibold ${!cur ? 'text-muted-foreground' : ''}`}
      >
        <span className="truncate text-left">{cur?.label || placeholder}</span>
        <span className="ml-2 text-xs text-muted-foreground">▼</span>
      </Button>
      {open && (
        <div className="absolute left-0 top-[calc(100%+4px)] z-50 w-full min-w-[14rem] rounded-lg border border-border bg-popover shadow-md">
          <div className="p-2 border-b border-border">
            <Input
              autoFocus
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Gõ để tìm…"
              className="h-9 text-sm font-semibold"
            />
          </div>
          <div className="max-h-64 overflow-y-auto p-1">
            {filtered.length === 0 ? (
              <div className="px-2 py-2 text-xs font-semibold text-muted-foreground">Không có kết quả</div>
            ) : (
              filtered.map((o) => (
                <button
                  key={String(o.value)}
                  type="button"
                  className={`flex w-full items-center rounded-md px-2 py-1.5 text-left text-sm font-semibold hover:bg-accent hover:text-accent-foreground ${
                    String(o.value) === String(value) ? 'bg-accent/60' : ''
                  }`}
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

export default function AdminUsers() {
  const [rows, setRows] = useState([]);
  const [officeRows, setOfficeRows] = useState([]);
  const [agencies, setAgencies] = useState([]);
  const [households, setHouseholds] = useState([]);
  const [regions, setRegions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [showEditDialog, setShowEditDialog] = useState(false);
  const [showViewDialog, setShowViewDialog] = useState(false);
  const [selectedAccount, setSelectedAccount] = useState(null);

  const [phone, setPhone] = useState('');
  const [password, setPassword] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [role, setRole] = useState('household_owner');
  const [agencyId, setAgencyId] = useState('');
  const [householdId, setHouseholdId] = useState('');
  const [regionCodes, setRegionCodes] = useState([]);

  const loadList = async () => {
    const { data, error } = await base44.supabase
      .from('field_accounts')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(200);

    if (error) {
      console.error(error);
      const missingTable =
        error.code === '42P01' || /relation .*field_accounts|field_accounts.*does not exist/i.test(error.message || '');
      toast.error(
        missingTable
          ? 'Chưa có bảng field_accounts — chạy scripts/migrations/20260429_field_accounts.sql (và 20260430_field_account_verify_rpc.sql).'
          : 'Không tải danh sách hiện trường: ' + error.message
      );
      setRows([]);
    } else {
      setRows((data || []).map(normalizeFieldAccountRow));
    }
  };

  const loadOfficeUsers = async () => {
    const { data, error } = await base44.rpc('list_office_auth_users');
    if (!error && data != null) {
      const list = typeof data === 'string' ? JSON.parse(data) : data;
      setOfficeRows(Array.isArray(list) ? list : []);
      return;
    }
    const { data: profiles, error: profileErr } = await base44.supabase
      .from('profiles')
      .select('id, role, display_name, phone, created_at')
      .order('created_at', { ascending: false })
      .limit(200);
    if (profileErr) {
      console.warn('profiles:', profileErr.message);
      setOfficeRows([]);
      return;
    }
    setOfficeRows(profiles || []);
  };

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const [ag, hh, reg] = await Promise.all([
          base44.entities.Agency.list('name', 500),
          base44.entities.Household.list('name', 500),
          base44.entities.RegionCode.list('sort_order', 200),
        ]);
        if (!cancelled) {
          setAgencies(ag || []);
          setHouseholds(hh || []);
          setRegions(reg || []);
        }
        await Promise.all([loadList(), loadOfficeUsers()]);
      } catch {
        if (!cancelled) toast.error('Lỗi tải dữ liệu');
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const agencySelectItems = useMemo(
    () =>
      agencies.map((a) => ({
        value: String(a.id),
        label: `${a.code} — ${a.name}`,
        searchText: `${a.code} ${a.name}`,
      })),
    [agencies]
  );
  const householdSelectItems = useMemo(
    () =>
      households.map((h) => {
        const seg = formatHouseholdSegmentDisplay(h.household_segment);
        const label = `${h.name} (${seg})`;
        const searchText = [h.name, seg, h.phone, h.address, h.region_code].filter(Boolean).join(' ');
        return { value: String(h.id), label, searchText };
      }),
    [households]
  );
  const roleLabel = ROLE_SELECT_ITEMS.find((r) => r.value === role)?.label ?? '';
  const regionMap = useMemo(() => Object.fromEntries(regions.map((r) => [String(r.code), r])), [regions]);
  const agMap = useMemo(() => Object.fromEntries(agencies.map((a) => [String(a.id), a])), [agencies]);
  const hhMap = useMemo(() => Object.fromEntries(households.map((h) => [String(h.id), h])), [households]);

  const onRoleChange = (v) => {
    setRole(v);
    if (v !== 'agency') setAgencyId('');
    if (v !== 'household_owner') setHouseholdId('');
    if (v !== 'manager') setRegionCodes([]);
  };

  const formatScopeCell = (r) => {
    if (r.role === 'agency') return agMap[String(r.agency_id)]?.code || '—';
    if (r.role === 'manager') {
      const codes = Array.isArray(r.region_codes) ? r.region_codes : [];
      if (codes.length === 0) return '—';
      return codes
        .map((c) => {
          const reg = regionMap[String(c)];
          return reg ? `${c} (${reg.name})` : c;
        })
        .join(', ');
    }
    return hhMap[String(r.household_id)]?.name || '—';
  };

  const fieldExportColumns = useMemo(
    () => [
      { header: 'SĐT', key: 'phone', width: 14 },
      { header: 'Mật khẩu', key: 'password_plaintext', width: 12 },
      { header: 'Tên hiển thị', key: 'display_name', width: 18 },
      { header: 'Vai trò', accessor: (r) => FIELD_ROLE_LABELS[r.role] || r.role, width: 12 },
      { header: 'Phạm vi', accessor: (r) => formatScopeCell(r), width: 28 },
      {
        header: 'Ngày tạo',
        accessor: (r) => (r.created_at ? new Date(r.created_at).toLocaleDateString('vi-VN') : ''),
        width: 12,
      },
    ],
    [agMap, hhMap, regionMap]
  );

  const officeExportColumns = useMemo(
    () => [
      { header: 'Email', key: 'email', width: 24 },
      { header: 'Tên hiển thị', key: 'display_name', width: 18 },
      { header: 'Vai trò', accessor: (r) => OFFICE_ROLE_LABELS[r.role] || r.role, width: 12 },
      { header: 'SĐT', key: 'phone', width: 14 },
      {
        header: 'Ngày tạo',
        accessor: (r) => (r.created_at ? new Date(r.created_at).toLocaleDateString('vi-VN') : ''),
        width: 12,
      },
    ],
    []
  );

  const handleCreate = async (e) => {
    e.preventDefault();
    const norm = normalizeVnPhone(phone);
    if (!norm || norm.length < 10) {
      toast.error('Số điện thoại không hợp lệ');
      return;
    }
    if (!password || password.length < 6) {
      toast.error('Mật khẩu tối thiểu 6 ký tự');
      return;
    }
    if (role === 'agency' && !agencyId) {
      toast.error('Chọn đại lý');
      return;
    }
    if (role === 'household_owner' && !householdId) {
      toast.error('Chọn hộ nuôi');
      return;
    }
    if (role === 'manager' && regionCodes.length === 0) {
      toast.error('Chọn ít nhất một khu vực');
      return;
    }

    const { data: dupFa } = await base44.supabase.from('field_accounts').select('id').eq('phone', norm).maybeSingle();
    if (dupFa) {
      toast.error('Số điện thoại đã có trong danh sách');
      return;
    }

    setSaving(true);
    try {
      const dname = displayName.trim() || norm;
      const { error: faErr } = await base44.supabase.from('field_accounts').insert({
        phone: norm,
        password_plaintext: password,
        role,
        agency_id: role === 'agency' ? agencyId : null,
        household_id: role === 'household_owner' ? householdId : null,
        region_codes: role === 'manager' ? regionCodes : [],
        display_name: dname,
      });

      if (faErr) {
        const needMigration = /region_codes|manager|field_accounts_scope_chk|field_accounts_role_check/i.test(faErr.message || '');
        toast.error(
          needMigration
            ? `${faErr.message} — Chạy scripts/migrations/20260527_field_accounts_manager_role.sql trên Supabase.`
            : faErr.message || 'Không tạo được tài khoản'
        );
        return;
      }

      toast.success('Đã tạo tài khoản');
      setPhone('');
      setPassword('');
      setDisplayName('');
      setHouseholdId('');
      setAgencyId('');
      setRegionCodes([]);
      setShowCreateDialog(false);
      await loadList();
    } catch (err) {
      toast.error(err?.message || 'Lỗi');
    }
    setSaving(false);
  };

  const handleEdit = async (e) => {
    e.preventDefault();
    if (!selectedAccount) return;

    const norm = normalizeVnPhone(phone);
    if (!norm || norm.length < 10) {
      toast.error('Số điện thoại không hợp lệ');
      return;
    }
    if (password && password.length < 6) {
      toast.error('Mật khẩu tối thiểu 6 ký tự');
      return;
    }
    if (role === 'agency' && !agencyId) {
      toast.error('Chọn đại lý');
      return;
    }
    if (role === 'household_owner' && !householdId) {
      toast.error('Chọn hộ nuôi');
      return;
    }
    if (role === 'manager' && regionCodes.length === 0) {
      toast.error('Chọn ít nhất một khu vực');
      return;
    }

    setSaving(true);
    try {
      const updates = {
        phone: norm,
        display_name: displayName.trim() || norm,
        role,
        agency_id: role === 'agency' ? agencyId : null,
        household_id: role === 'household_owner' ? householdId : null,
        region_codes: role === 'manager' ? regionCodes : [],
      };
      if (password) {
        updates.password_plaintext = password;
      }

      const { error } = await base44.supabase
        .from('field_accounts')
        .update(updates)
        .eq('id', selectedAccount.id);

      if (error) {
        toast.error(error.message || 'Không cập nhật được');
        return;
      }

      toast.success('Đã cập nhật tài khoản');
      setShowEditDialog(false);
      setSelectedAccount(null);
      await loadList();
    } catch (err) {
      toast.error(err?.message || 'Lỗi');
    }
    setSaving(false);
  };

  const handleDelete = async (account) => {
    if (!window.confirm(`Xóa tài khoản ${account.phone}?\n\nHành động này không thể hoàn tác!`)) return;

    try {
      const { error } = await base44.supabase
        .from('field_accounts')
        .delete()
        .eq('id', account.id);

      if (error) {
        toast.error(error.message || 'Không xóa được');
        return;
      }

      toast.success('Đã xóa tài khoản');
      await loadList();
    } catch (err) {
      toast.error(err?.message || 'Lỗi');
    }
  };

  const openCreateDialog = () => {
    setPhone('');
    setPassword('');
    setDisplayName('');
    setRole('household_owner');
    setAgencyId('');
    setHouseholdId('');
    setRegionCodes([]);
    setShowCreateDialog(true);
  };

  const openEditDialog = (account) => {
    setSelectedAccount(account);
    setPhone(account.phone || '');
    setPassword('');
    setDisplayName(account.display_name || '');
    setRole(account.role || 'household_owner');
    setAgencyId(account.agency_id != null ? String(account.agency_id) : '');
    setHouseholdId(account.household_id != null ? String(account.household_id) : '');
    setRegionCodes(Array.isArray(account.region_codes) ? account.region_codes.map(String) : []);
    setShowEditDialog(true);
  };

  const openViewDialog = (account) => {
    setSelectedAccount(account);
    setShowViewDialog(true);
  };

  if (loading) {
    return (
      <div className="p-3 sm:p-6">
        <div className="flex items-center justify-center py-20">
          <div className="w-10 h-10 border-4 border-primary/30 border-t-primary rounded-full animate-spin" />
        </div>
      </div>
    );
  }

  return (
    <div className="p-3 sm:p-6 space-y-6 max-w-6xl mx-auto w-full">
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-start gap-3">
          <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center shrink-0">
            <UserPlus className="w-5 h-5 text-primary" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-foreground tracking-tight">Tài khoản</h1>
            <p className="text-sm text-muted-foreground mt-0.5">
              <strong className="text-foreground font-medium">Hiện trường</strong> — SĐT, tab Hiện trường.
              {' '}
              <strong className="text-foreground font-medium">Văn phòng</strong> — email, tab Văn phòng (Quản trị xem full).
            </p>
          </div>
        </div>
        <Button onClick={openCreateDialog} className="bg-primary text-white flex items-center gap-2">
          <Plus className="w-4 h-4" />
          Thêm tài khoản
        </Button>
      </div>

      <section className="bg-card border border-border rounded-xl shadow-sm overflow-hidden">
        <div className="px-5 py-4 border-b border-border flex flex-wrap items-center justify-between gap-2">
          <h2 className="text-sm font-semibold text-foreground">Hiện trường — SĐT ({rows.length})</h2>
          <ExportExcelButton
            fileName="tai-khoan-hien-truong"
            sheetName="Hiện trường"
            title="Tài khoản hiện trường"
            columns={fieldExportColumns}
            rows={rows}
            disabled={rows.length === 0}
            className="gap-2 text-sm h-9 px-3"
          />
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm min-w-[920px]">
            <thead>
              <tr className="bg-muted/50 text-left text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                <th className="px-4 py-3 whitespace-nowrap">SĐT</th>
                <th className="px-4 py-3 whitespace-nowrap">Mật khẩu</th>
                <th className="px-4 py-3 whitespace-nowrap">Tên hiển thị</th>
                <th className="px-4 py-3 whitespace-nowrap">Vai trò</th>
                <th className="px-4 py-3 whitespace-nowrap">Phạm vi</th>
                <th className="px-4 py-3 whitespace-nowrap">Ngày tạo</th>
                <th className="px-4 py-3 text-center whitespace-nowrap">Thao tác</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {rows.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-4 py-10 text-center text-sm text-muted-foreground">
                    Chưa có tài khoản hiện trường. Bấm «Thêm tài khoản» để tạo.
                  </td>
                </tr>
              ) : null}
              {rows.map((r) => (
                <tr key={r.id} className="hover:bg-muted/30">
                  <td className="px-4 py-3 font-mono text-foreground whitespace-nowrap">{r.phone || '—'}</td>
                  <td className="px-4 py-3 font-mono text-sm text-foreground whitespace-nowrap">
                    {r.password_plaintext || '—'}
                  </td>
                  <td className="px-4 py-3 text-foreground whitespace-nowrap">{r.display_name || '—'}</td>
                  <td className="px-4 py-3 whitespace-nowrap">
                    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${roleBadgeClass(r.role)}`}>
                      {FIELD_ROLE_LABELS[r.role] || r.role || '—'}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-muted-foreground whitespace-nowrap max-w-[280px] truncate" title={formatScopeCell(r)}>
                    {formatScopeCell(r)}
                  </td>
                  <td className="px-4 py-3 text-muted-foreground whitespace-nowrap text-xs">
                    {r.created_at ? new Date(r.created_at).toLocaleDateString('vi-VN') : '—'}
                  </td>
                  <td className="px-4 py-3 text-center whitespace-nowrap">
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="icon" className="h-8 w-8">
                          <MoreHorizontal className="w-4 h-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem onClick={() => openViewDialog(r)}>
                          <Eye className="w-4 h-4 mr-2" />
                          Xem chi tiết
                        </DropdownMenuItem>
                        <DropdownMenuItem onClick={() => openEditDialog(r)}>
                          <Edit className="w-4 h-4 mr-2" />
                          Sửa
                        </DropdownMenuItem>
                        <DropdownMenuSeparator />
                        <DropdownMenuItem onClick={() => handleDelete(r)} className="text-red-600 focus:text-red-600">
                          <Trash2 className="w-4 h-4 mr-2" />
                          Xóa
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section className="bg-card border border-border rounded-xl shadow-sm overflow-hidden">
        <div className="px-5 py-4 border-b border-border flex flex-wrap items-start justify-between gap-2">
          <div>
            <h2 className="text-sm font-semibold text-foreground">Văn phòng — Email ({officeRows.length})</h2>
            <p className="text-xs text-muted-foreground mt-1">Tạo admin: <code className="text-foreground">npm run seed:admin</code></p>
          </div>
          <ExportExcelButton
            fileName="tai-khoan-van-phong"
            sheetName="Văn phòng"
            title="Tài khoản văn phòng"
            columns={officeExportColumns}
            rows={officeRows}
            disabled={officeRows.length === 0}
            className="gap-2 text-sm h-9 px-3"
          />
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm min-w-[720px]">
            <thead>
              <tr className="bg-muted/50 text-left text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                <th className="px-4 py-3 whitespace-nowrap">Email</th>
                <th className="px-4 py-3 whitespace-nowrap">Tên hiển thị</th>
                <th className="px-4 py-3 whitespace-nowrap">Vai trò</th>
                <th className="px-4 py-3 whitespace-nowrap">SĐT (profile)</th>
                <th className="px-4 py-3 whitespace-nowrap">Ngày tạo</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {officeRows.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-4 py-10 text-center text-sm text-muted-foreground">
                    Chưa có tài khoản văn phòng.
                  </td>
                </tr>
              ) : (
                officeRows.map((r) => (
                  <tr key={r.id} className="hover:bg-muted/30">
                    <td className="px-4 py-3 font-mono text-foreground whitespace-nowrap">{r.email || '—'}</td>
                    <td className="px-4 py-3 text-foreground whitespace-nowrap">{r.display_name || '—'}</td>
                    <td className="px-4 py-3 whitespace-nowrap">
                      <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${
                        r.role === 'admin' ? 'bg-amber-100 text-amber-800' : roleBadgeClass(r.role)
                      }`}>
                        {OFFICE_ROLE_LABELS[r.role] || r.role || '—'}
                      </span>
                    </td>
                    <td className="px-4 py-3 font-mono text-muted-foreground whitespace-nowrap">{r.phone || '—'}</td>
                    <td className="px-4 py-3 text-muted-foreground whitespace-nowrap text-xs">
                      {r.created_at ? new Date(r.created_at).toLocaleDateString('vi-VN') : '—'}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </section>

      {/* Dialog tạo mới */}
      <Dialog open={showCreateDialog} onOpenChange={setShowCreateDialog}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Tạo tài khoản mới</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleCreate} className="space-y-4 py-2">
            <div>
              <Label>Số điện thoại</Label>
              <Input value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="0987…" className="mt-1" />
            </div>
            <div>
              <Label>Mật khẩu</Label>
              <Input type="password" value={password} onChange={(e) => setPassword(e.target.value)} className="mt-1" />
            </div>
            <div>
              <Label>Tên hiển thị (tuỳ chọn)</Label>
              <Input value={displayName} onChange={(e) => setDisplayName(e.target.value)} className="mt-1" />
            </div>
            <div>
              <Label>Vai trò</Label>
              <Select value={role} onValueChange={onRoleChange}>
                <SelectTrigger className="mt-1">
                  <SelectValue placeholder="Chọn vai trò">{roleLabel}</SelectValue>
                </SelectTrigger>
                <SelectContent>
                  {ROLE_SELECT_ITEMS.map((item) => (
                    <SelectItem key={item.value} value={item.value}>{item.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            {role === 'agency' ? (
              <div>
                <Label>Đại lý</Label>
                <SearchSelect
                  value={agencyId}
                  onChange={setAgencyId}
                  options={agencySelectItems}
                  placeholder="Chọn đại lý"
                />
              </div>
            ) : role === 'manager' ? (
              <div>
                <Label>Khu vực phân công *</Label>
                <p className="text-xs text-muted-foreground mt-0.5 mb-1">Chọn một hoặc nhiều khu vực</p>
                <RegionCheckboxGroup regions={regions} value={regionCodes} onChange={setRegionCodes} />
              </div>
            ) : (
              <div>
                <Label>Hộ nuôi</Label>
                <SearchSelect
                  value={householdId}
                  onChange={setHouseholdId}
                  options={householdSelectItems}
                  placeholder="Chọn hộ"
                />
              </div>
            )}
            <DialogFooter>
              <Button type="submit" disabled={saving} className="w-full">
                {saving ? 'Đang tạo…' : 'Tạo tài khoản'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Dialog sửa */}
      <Dialog open={showEditDialog} onOpenChange={setShowEditDialog}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Sửa tài khoản</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleEdit} className="space-y-4 py-2">
            <div>
              <Label>Số điện thoại</Label>
              <Input value={phone} onChange={(e) => setPhone(e.target.value)} className="mt-1" />
            </div>
            <div>
              <Label>Mật khẩu mới (để trống nếu không đổi)</Label>
              <Input type="password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="Nhập mật khẩu mới..." className="mt-1" />
            </div>
            <div>
              <Label>Tên hiển thị</Label>
              <Input value={displayName} onChange={(e) => setDisplayName(e.target.value)} className="mt-1" />
            </div>
            <div>
              <Label>Vai trò</Label>
              <Select value={role} onValueChange={onRoleChange}>
                <SelectTrigger className="mt-1">
                  <SelectValue placeholder="Chọn vai trò">{roleLabel}</SelectValue>
                </SelectTrigger>
                <SelectContent>
                  {ROLE_SELECT_ITEMS.map((item) => (
                    <SelectItem key={item.value} value={item.value}>{item.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            {role === 'agency' ? (
              <div>
                <Label>Đại lý</Label>
                <SearchSelect
                  value={agencyId}
                  onChange={setAgencyId}
                  options={agencySelectItems}
                  placeholder="Chọn đại lý"
                />
              </div>
            ) : role === 'manager' ? (
              <div>
                <Label>Khu vực phân công *</Label>
                <p className="text-xs text-muted-foreground mt-0.5 mb-1">Chọn một hoặc nhiều khu vực</p>
                <RegionCheckboxGroup regions={regions} value={regionCodes} onChange={setRegionCodes} />
              </div>
            ) : (
              <div>
                <Label>Hộ nuôi</Label>
                <SearchSelect
                  value={householdId}
                  onChange={setHouseholdId}
                  options={householdSelectItems}
                  placeholder="Chọn hộ"
                />
              </div>
            )}
            <DialogFooter>
              <Button type="submit" disabled={saving} className="w-full">
                {saving ? 'Đang lưu…' : 'Lưu thay đổi'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Dialog xem */}
      <Dialog open={showViewDialog} onOpenChange={setShowViewDialog}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Chi tiết tài khoản</DialogTitle>
          </DialogHeader>
          {selectedAccount && (
            <div className="space-y-3 py-2">
              <div className="grid grid-cols-3 gap-2 text-sm">
                <span className="text-muted-foreground">Số điện thoại:</span>
                <span className="col-span-2 font-mono font-semibold">{selectedAccount.phone}</span>
              </div>
              <div className="grid grid-cols-3 gap-2 text-sm">
                <span className="text-muted-foreground">Mật khẩu:</span>
                <span className="col-span-2 font-mono">{selectedAccount.password_plaintext || '—'}</span>
              </div>
              <div className="grid grid-cols-3 gap-2 text-sm">
                <span className="text-muted-foreground">Tên hiển thị:</span>
                <span className="col-span-2 font-semibold">{selectedAccount.display_name || '—'}</span>
              </div>
              <div className="grid grid-cols-3 gap-2 text-sm">
                <span className="text-muted-foreground">Vai trò:</span>
                <span className="col-span-2">
                  <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${roleBadgeClass(selectedAccount.role)}`}>
                    {FIELD_ROLE_LABELS[selectedAccount.role] || selectedAccount.role || '—'}
                  </span>
                </span>
              </div>
              <div className="grid grid-cols-3 gap-2 text-sm">
                <span className="text-muted-foreground">Phạm vi:</span>
                <span className="col-span-2 font-semibold">
                  {selectedAccount.role === 'agency'
                    ? (() => {
                        const ag = agMap[String(selectedAccount.agency_id)];
                        return ag ? `${ag.code} — ${ag.name}` : '—';
                      })()
                    : selectedAccount.role === 'manager'
                      ? (() => {
                          const codes = Array.isArray(selectedAccount.region_codes) ? selectedAccount.region_codes : [];
                          if (codes.length === 0) return '—';
                          return codes
                            .map((c) => {
                              const reg = regionMap[String(c)];
                              return reg ? `${c} — ${reg.name}` : c;
                            })
                            .join(', ');
                        })()
                      : (() => {
                          const hh = hhMap[String(selectedAccount.household_id)];
                          return hh ? `${hh.name} (${formatHouseholdSegmentDisplay(hh.household_segment)})` : '—';
                        })()}
                </span>
              </div>
              <div className="grid grid-cols-3 gap-2 text-sm">
                <span className="text-muted-foreground">Ngày tạo:</span>
                <span className="col-span-2 text-xs">
                  {selectedAccount.created_at ? new Date(selectedAccount.created_at).toLocaleString('vi-VN') : '—'}
                </span>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
