import { useState } from 'react';
import { KeyRound, Save } from 'lucide-react';
import { base44 } from '@/api/base44Client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { formatSupabaseError } from '@/lib/supabaseErrors';
import { normalizeVnPhone } from '@/lib/fieldAuthHelpers';
import { toast } from 'sonner';

function validatePasswordPair(newPassword, confirmPassword) {
  if (!newPassword || newPassword.length < 6) {
    return 'Mật khẩu mới tối thiểu 6 ký tự';
  }
  if (newPassword !== confirmPassword) {
    return 'Mật khẩu xác nhận không khớp';
  }
  return '';
}

/**
 * @param {'field' | 'office'} mode
 * @param {{ phone?: string, email?: string, label?: string }} account
 * @param {'default' | 'field'} variant
 */
export default function ChangePasswordForm({ mode, account, variant = 'default' }) {
  const [oldPassword, setOldPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const isFieldUi = variant === 'field';
  const accountLabel = account?.label || account?.phone || account?.email || 'tài khoản';

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    if (!oldPassword) {
      setError('Nhập mật khẩu hiện tại');
      return;
    }
    const pairErr = validatePasswordPair(newPassword, confirmPassword);
    if (pairErr) {
      setError(pairErr);
      return;
    }
    if (oldPassword === newPassword) {
      setError('Mật khẩu mới phải khác mật khẩu hiện tại');
      return;
    }

    setSaving(true);
    try {
      if (mode === 'field') {
        const phone = normalizeVnPhone(account?.phone || '');
        if (!phone) {
          setError('Không xác định được số điện thoại');
          setSaving(false);
          return;
        }
        const ok = await base44.auth.changeFieldPassword(phone, oldPassword, newPassword);
        if (!ok) {
          setError('Mật khẩu hiện tại không đúng');
          setSaving(false);
          return;
        }
      } else {
        const email = String(account?.email || '').trim();
        if (!email) {
          setError('Không xác định được email đăng nhập');
          setSaving(false);
          return;
        }
        await base44.auth.changeOfficePassword(email, oldPassword, newPassword);
      }
      setOldPassword('');
      setNewPassword('');
      setConfirmPassword('');
      toast.success('Đã đổi mật khẩu');
    } catch (err) {
      const msg = formatSupabaseError(err);
      if (/field_account_change_password|function.*does not exist/i.test(msg)) {
        setError(`${msg} — Chạy scripts/migrations/20260529_password_change_rpc.sql trên Supabase.`);
      } else {
        setError(msg);
      }
    }
    setSaving(false);
  };

  const cardClass = isFieldUi
    ? 'rounded-2xl border border-stone-200 bg-white p-5 shadow-sm space-y-4'
    : 'bg-card border border-border rounded-xl p-5 space-y-4 shadow-sm';

  return (
    <form onSubmit={handleSubmit} className={cardClass}>
      <div className="flex items-start gap-3">
        <div
          className={
            isFieldUi
              ? 'w-10 h-10 rounded-xl bg-teal-100 flex items-center justify-center shrink-0'
              : 'w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center shrink-0'
          }
        >
          <KeyRound className={isFieldUi ? 'w-5 h-5 text-teal-700' : 'w-5 h-5 text-primary'} />
        </div>
        <div>
          <h2 className="text-lg font-bold text-foreground">Đổi mật khẩu</h2>
          <p className="text-sm text-muted-foreground mt-0.5">
            Tài khoản: <span className="font-semibold text-foreground">{accountLabel}</span>
          </p>
        </div>
      </div>

      {error ? (
        <p className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">{error}</p>
      ) : null}

      <div>
        <Label>Mật khẩu hiện tại</Label>
        <Input
          type="password"
          autoComplete="current-password"
          value={oldPassword}
          onChange={(e) => setOldPassword(e.target.value)}
          className="mt-1.5"
          placeholder="••••••"
        />
      </div>
      <div>
        <Label>Mật khẩu mới</Label>
        <Input
          type="password"
          autoComplete="new-password"
          value={newPassword}
          onChange={(e) => setNewPassword(e.target.value)}
          className="mt-1.5"
          placeholder="Tối thiểu 6 ký tự"
        />
      </div>
      <div>
        <Label>Nhập lại mật khẩu mới</Label>
        <Input
          type="password"
          autoComplete="new-password"
          value={confirmPassword}
          onChange={(e) => setConfirmPassword(e.target.value)}
          className="mt-1.5"
          placeholder="Nhập lại mật khẩu mới"
        />
      </div>

      <Button
        type="submit"
        disabled={saving}
        className={isFieldUi ? 'w-full h-12 bg-teal-600 hover:bg-teal-700 text-white font-bold' : 'bg-primary text-white'}
      >
        <Save className="w-4 h-4 mr-2" />
        {saving ? 'Đang lưu…' : 'Lưu mật khẩu mới'}
      </Button>
    </form>
  );
}

export function AdminSetPasswordForm({ target, onClose, onSaved }) {
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  if (!target) return null;

  const label = target.kind === 'field' ? target.phone : target.email;

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    const pairErr = validatePasswordPair(newPassword, confirmPassword);
    if (pairErr) {
      setError(pairErr);
      return;
    }
    setSaving(true);
    try {
      if (target.kind === 'field') {
        const ok = await base44.auth.adminSetFieldPassword(target.id, newPassword);
        if (!ok) throw new Error('Không cập nhật được mật khẩu');
      } else {
        const ok = await base44.auth.adminSetOfficePassword(target.id, newPassword);
        if (!ok) throw new Error('Không cập nhật được mật khẩu');
      }
      toast.success('Đã đặt mật khẩu mới');
      setNewPassword('');
      setConfirmPassword('');
      await onSaved?.();
      onClose?.();
    } catch (err) {
      const msg = formatSupabaseError(err);
      if (/admin_set_|field_account_change_password|function.*does not exist/i.test(msg)) {
        setError(`${msg} — Chạy scripts/migrations/20260529_password_change_rpc.sql trên Supabase.`);
      } else {
        setError(msg);
      }
    }
    setSaving(false);
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4 py-1">
      <p className="text-sm text-muted-foreground">
        Đặt mật khẩu mới cho <span className="font-semibold text-foreground">{label}</span>
      </p>
      {error ? (
        <p className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">{error}</p>
      ) : null}
      <div>
        <Label>Mật khẩu mới</Label>
        <Input
          type="password"
          value={newPassword}
          onChange={(e) => setNewPassword(e.target.value)}
          className="mt-1"
          placeholder="Tối thiểu 6 ký tự"
          autoFocus
        />
      </div>
      <div>
        <Label>Nhập lại mật khẩu mới</Label>
        <Input
          type="password"
          value={confirmPassword}
          onChange={(e) => setConfirmPassword(e.target.value)}
          className="mt-1"
        />
      </div>
      <div className="flex justify-end gap-2 pt-1">
        <Button type="button" variant="outline" onClick={onClose} disabled={saving}>
          Hủy
        </Button>
        <Button type="submit" disabled={saving} className="bg-primary text-white">
          {saving ? 'Đang lưu…' : 'Lưu mật khẩu'}
        </Button>
      </div>
    </form>
  );
}
