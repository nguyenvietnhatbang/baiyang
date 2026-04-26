import { useEffect, useMemo, useState } from 'react';
import { base44 } from '@/api/base44Client';
import { normalizeVnPhone } from '@/lib/fieldAuthHelpers';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { toast } from 'sonner';
import { UserPlus } from 'lucide-react';

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
      await loadList();
    } catch (err) {
      toast.error(err?.message || 'Lỗi');
    }
    setSaving(false);
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
    <div className="p-3 sm:p-6 space-y-8 max-w-5xl mx-auto w-full">
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

      <section className="bg-card border border-border rounded-xl shadow-sm p-5 sm:p-6 space-y-4">
        <h2 className="text-sm font-semibold text-foreground uppercase tracking-wide">Tạo tài khoản mới</h2>
        <form onSubmit={handleCreate} className="flex flex-col gap-4 w-full max-w-2xl">
          <div className="space-y-1.5 w-full">
            <Label htmlFor="adm-phone">Số điện thoại</Label>
            <Input
              id="adm-phone"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              placeholder="0987…"
              className="w-full"
            />
          </div>
          <div className="space-y-1.5 w-full">
            <Label htmlFor="adm-pass">Mật khẩu</Label>
            <Input
              id="adm-pass"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full"
            />
          </div>
          <div className="space-y-1.5 w-full">
            <Label htmlFor="adm-name">Tên hiển thị (tuỳ chọn)</Label>
            <Input id="adm-name" value={displayName} onChange={(e) => setDisplayName(e.target.value)} className="w-full" />
          </div>
          <div className="space-y-1.5 w-full">
            <Label>Vai trò</Label>
            <Select value={role} onValueChange={setRole} items={ROLE_SELECT_ITEMS}>
              <SelectTrigger className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="agency">Đại lý</SelectItem>
                <SelectItem value="household_owner">Chủ hộ</SelectItem>
              </SelectContent>
            </Select>
          </div>
          {role === 'agency' ? (
            <div className="space-y-1.5 w-full">
              <Label>Đại lý</Label>
              <Select value={agencyId} onValueChange={setAgencyId} items={agencySelectItems}>
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="Chọn đại lý" />
                </SelectTrigger>
                <SelectContent>
                  {agencies.map((a) => (
                    <SelectItem key={a.id} value={a.id}>
                      {a.code} — {a.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          ) : (
            <div className="space-y-1.5 w-full">
              <Label>Hộ nuôi</Label>
              <Select value={householdId} onValueChange={setHouseholdId} items={householdSelectItems}>
                <SelectTrigger className="w-full">
                  <SelectValue placeholder={households.length ? 'Chọn hộ' : 'Chưa có hộ trong hệ thống'} />
                </SelectTrigger>
                <SelectContent>
                  {households.map((h) => (
                    <SelectItem key={h.id} value={h.id}>
                      {h.name} ({h.household_segment})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}
          <div className="w-full pt-1">
            <Button type="submit" disabled={saving} className="w-full sm:w-auto min-w-[10rem]">
              {saving ? 'Đang tạo…' : 'Tạo tài khoản'}
            </Button>
          </div>
        </form>
      </section>

      <section className="bg-card border border-border rounded-xl shadow-sm overflow-hidden">
        <div className="px-5 py-4 border-b border-border">
          <h2 className="text-sm font-semibold text-foreground">Đã cấp quyền ({rows.length})</h2>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-muted/50 text-left text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                <th className="px-4 py-3">SĐT</th>
                <th className="px-4 py-3">Mật khẩu (lưu thô)</th>
                <th className="px-4 py-3">Vai trò</th>
                <th className="px-4 py-3">Đại lý / Hộ</th>
                <th className="px-4 py-3">Ngày tạo</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {rows.map((r) => (
                <tr key={r.id} className="hover:bg-muted/30">
                  <td className="px-4 py-3 font-mono text-foreground">{r.phone || '—'}</td>
                  <td className="px-4 py-3 font-mono text-foreground">{r.password_plaintext ?? '—'}</td>
                  <td className="px-4 py-3">{r.role === 'agency' ? 'Đại lý' : 'Chủ hộ'}</td>
                  <td className="px-4 py-3 text-muted-foreground">
                    {r.role === 'agency'
                      ? agMap[r.agency_id]?.code || '—'
                      : hhMap[r.household_id]?.name || '—'}
                  </td>
                  <td className="px-4 py-3 text-muted-foreground whitespace-nowrap text-xs">
                    {r.created_at ? new Date(r.created_at).toLocaleDateString('vi-VN') : '—'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
