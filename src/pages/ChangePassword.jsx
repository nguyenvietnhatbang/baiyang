import { Navigate } from 'react-router-dom';
import { useAuth } from '@/lib/AuthContext';
import ChangePasswordForm from '@/components/account/ChangePasswordForm';
import { normalizeVnPhone } from '@/lib/fieldAuthHelpers';

/** Văn phòng: tự đổi mật khẩu email (Supabase Auth). */
export default function ChangePassword() {
  const { user } = useAuth();

  if (user?.fieldSession) {
    return <Navigate to="/field/password" replace />;
  }

  if (!user?.email) {
    return (
      <div className="p-6 max-w-lg mx-auto">
        <p className="text-muted-foreground text-sm">Đăng nhập để đổi mật khẩu.</p>
      </div>
    );
  }

  return (
    <div className="p-4 sm:p-6 max-w-md mx-auto space-y-4">
      <div>
        <h1 className="text-2xl font-bold text-foreground">Tài khoản</h1>
        <p className="text-sm text-muted-foreground mt-0.5">Đổi mật khẩu đăng nhập văn phòng</p>
      </div>
      <ChangePasswordForm
        mode="office"
        account={{
          email: user.email,
          label: user.name || user.email,
        }}
      />
    </div>
  );
}

/** Hiện trường: tự đổi mật khẩu SĐT. */
export function FieldChangePassword() {
  const { user } = useAuth();
  const phone = normalizeVnPhone(user?.profile?.phone || user?.name || '') || user?.profile?.phone;

  if (!user?.fieldSession || !phone) {
    return (
      <div className="rounded-2xl border border-stone-200 bg-white p-5 text-sm text-stone-600">
        Đăng nhập hiện trường để đổi mật khẩu.
      </div>
    );
  }

  return (
    <div className="space-y-4 max-w-lg">
      <div>
        <h1 className="text-xl font-bold text-stone-900">Đổi mật khẩu</h1>
        <p className="text-sm text-stone-600 mt-0.5">Cập nhật mật khẩu đăng nhập hiện trường</p>
      </div>
      <ChangePasswordForm
        mode="field"
        variant="field"
        account={{
          phone,
          label: user.name || phone,
        }}
      />
    </div>
  );
}
