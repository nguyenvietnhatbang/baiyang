import { useEffect, useMemo, useState } from 'react';
import { base44 } from '@/api/base44Client';
import { normalizeVnPhone } from '@/lib/fieldAuthHelpers';
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

const ROLE_SELECT_ITEMS = [
  { value: 'agency', label: 'Đại lý' },
  { value: 'household_owner', label: 'Chủ hộ' },
];

export default function AdminUsers() {
  const [rows, setRows] = useState([]);
  const [agencies, setAgencies] = useState([]);
  const [households, setHouseholds] = useState([]);
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

  const loadList = async () => {
    const { data, error } = await base44.supabase
      .from('field_accounts')
      .select('id, phone, password_plaintext, role, agency_id, household_id, display_name, created_at')
      .order('created_at', { ascending: false })
      .limit(200);

    if (error) {
      console.error(error);
      const missingTable =
        error.code === '42P01' || /relation .*field_accounts|field_accounts.*does not exist/i.test(error.message || '');
      toast.error(
        missingTable
          ? 'Chưa có bảng field_accounts — chạy scripts/migrations/20260429_field_accounts.sql (và 20260430_field_account_verify_rpc.sql).'
          : 'Không tải danh sách: ' + error.message
      );
      return;
    }
    setRows(data || []);
  };

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const [ag, hh] = await Promise.all([
          base44.entities.Agency.list('name', 500),
          base44.entities.Household.list('name', 500),
        ]);
        if (!cancelled) {
          setAgencies(ag || []);
          setHouseholds(hh || []);
        }
        await loadList();
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
    () => agencies.map((a) => ({ value: a.id, label: `${a.code} — ${a.name}` })),
    [agencies]
  );
  const householdSelectItems = useMemo(
    () => households.map((h) => ({ value: h.id, label: `${h.name} (${h.household_segment})` })),
    [households]
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
        display_name: dname,
      });

      if (faErr) {
        toast.error(faErr.message || 'Không tạo được tài khoản');
        return;
      }

      toast.success('Đã tạo tài khoản');
      setPhone('');
      setPassword('');
      setDisplayName('');
      setHouseholdId('');
      setAgencyId('');
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

    setSaving(true);
    try {
      const updates = {
        phone: norm,
        display_name: displayName.trim() || norm,
        role,
        agency_id: role === 'agency' ? agencyId : null,
        household_id: role === 'household_owner' ? householdId : null,
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
    setShowCreateDialog(true);
  };

  const openEditDialog = (account) => {
    setSelectedAccount(account);
    setPhone(account.phone || '');
    setPassword('');
    setDisplayName(account.display_name || '');
    setRole(account.role || 'household_owner');
    setAgencyId(account.agency_id || '');
    setHouseholdId(account.household_id || '');
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

  const agMap = Object.fromEntries(agencies.map((a) => [a.id, a]));
  const hhMap = Object.fromEntries(households.map((h) => [h.id, h]));

  return (
    <div className="p-3 sm:p-6 space-y-6 max-w-6xl mx-auto w-full">
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-start gap-3">
          <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center shrink-0">
            <UserPlus className="w-5 h-5 text-primary" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-foreground tracking-tight">Tài khoản hiện trường</h1>
            <p className="text-sm text-muted-foreground mt-0.5">
              Tài khoản hiện trường đăng nhập tại trang đăng nhập chung, tab <strong className="text-foreground font-medium">Hiện trường</strong>.
            </p>
          </div>
        </div>
        <Button onClick={openCreateDialog} className="bg-primary text-white flex items-center gap-2">
          <Plus className="w-4 h-4" />
          Thêm tài khoản
        </Button>
      </div>

      <section className="bg-card border border-border rounded-xl shadow-sm overflow-hidden">
        <div className="px-5 py-4 border-b border-border">
          <h2 className="text-sm font-semibold text-foreground">Đã cấp quyền ({rows.length})</h2>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm min-w-[800px]">
            <thead>
              <tr className="bg-muted/50 text-left text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                <th className="px-4 py-3 whitespace-nowrap">SĐT</th>
                <th className="px-4 py-3 whitespace-nowrap">Tên hiển thị</th>
                <th className="px-4 py-3 whitespace-nowrap">Vai trò</th>
                <th className="px-4 py-3 whitespace-nowrap">Đại lý / Hộ</th>
                <th className="px-4 py-3 whitespace-nowrap">Ngày tạo</th>
                <th className="px-4 py-3 text-center whitespace-nowrap">Thao tác</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {rows.map((r) => (
                <tr key={r.id} className="hover:bg-muted/30">
                  <td className="px-4 py-3 font-mono text-foreground whitespace-nowrap">{r.phone || '—'}</td>
                  <td className="px-4 py-3 text-foreground whitespace-nowrap">{r.display_name || '—'}</td>
                  <td className="px-4 py-3 whitespace-nowrap">
                    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${
                      r.role === 'agency' ? 'bg-blue-100 text-blue-700' : 'bg-green-100 text-green-700'
                    }`}>
                      {r.role === 'agency' ? 'Đại lý' : 'Chủ hộ'}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-muted-foreground whitespace-nowrap">
                    {r.role === 'agency'
                      ? agMap[r.agency_id]?.code || '—'
                      : hhMap[r.household_id]?.name || '—'}
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
              <Select value={role} onValueChange={setRole}>
                <SelectTrigger className="mt-1">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="agency">Đại lý</SelectItem>
                  <SelectItem value="household_owner">Chủ hộ</SelectItem>
                </SelectContent>
              </Select>
            </div>
            {role === 'agency' ? (
              <div>
                <Label>Đại lý</Label>
                <Select value={agencyId} onValueChange={setAgencyId}>
                  <SelectTrigger className="mt-1">
                    <SelectValue placeholder="Chọn đại lý" />
                  </SelectTrigger>
                  <SelectContent>
                    {agencies.map((a) => (
                      <SelectItem key={a.id} value={a.id}>{a.code} — {a.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            ) : (
              <div>
                <Label>Hộ nuôi</Label>
                <Select value={householdId} onValueChange={setHouseholdId}>
                  <SelectTrigger className="mt-1">
                    <SelectValue placeholder="Chọn hộ" />
                  </SelectTrigger>
                  <SelectContent>
                    {households.map((h) => (
                      <SelectItem key={h.id} value={h.id}>{h.name} ({h.household_segment})</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
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
              <Select value={role} onValueChange={setRole}>
                <SelectTrigger className="mt-1">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="agency">Đại lý</SelectItem>
                  <SelectItem value="household_owner">Chủ hộ</SelectItem>
                </SelectContent>
              </Select>
            </div>
            {role === 'agency' ? (
              <div>
                <Label>Đại lý</Label>
                <Select value={agencyId} onValueChange={setAgencyId}>
                  <SelectTrigger className="mt-1">
                    <SelectValue placeholder="Chọn đại lý" />
                  </SelectTrigger>
                  <SelectContent>
                    {agencies.map((a) => (
                      <SelectItem key={a.id} value={a.id}>{a.code} — {a.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            ) : (
              <div>
                <Label>Hộ nuôi</Label>
                <Select value={householdId} onValueChange={setHouseholdId}>
                  <SelectTrigger className="mt-1">
                    <SelectValue placeholder="Chọn hộ" />
                  </SelectTrigger>
                  <SelectContent>
                    {households.map((h) => (
                      <SelectItem key={h.id} value={h.id}>{h.name} ({h.household_segment})</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
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
                  <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${
                    selectedAccount.role === 'agency' ? 'bg-blue-100 text-blue-700' : 'bg-green-100 text-green-700'
                  }`}>
                    {selectedAccount.role === 'agency' ? 'Đại lý' : 'Chủ hộ'}
                  </span>
                </span>
              </div>
              <div className="grid grid-cols-3 gap-2 text-sm">
                <span className="text-muted-foreground">{selectedAccount.role === 'agency' ? 'Đại lý:' : 'Hộ nuôi:'}</span>
                <span className="col-span-2 font-semibold">
                  {selectedAccount.role === 'agency'
                    ? agMap[selectedAccount.agency_id]?.name || '—'
                    : hhMap[selectedAccount.household_id]?.name || '—'}
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
