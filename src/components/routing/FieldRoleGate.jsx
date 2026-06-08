import { Navigate, Outlet } from 'react-router-dom';
import { useAuth } from '@/lib/AuthContext';
import { isFieldRole } from '@/lib/fieldAuthHelpers';

/** Chỉ đại lý / chủ hộ / quản lý vào /field. Admin → trang chủ văn phòng */
export default function FieldRoleGate() {
  const { user, isLoadingAuth } = useAuth();

  if (isLoadingAuth) {
    return (
      <div className="min-h-[100dvh] flex items-center justify-center bg-gradient-to-b from-amber-50 to-teal-50/50">
        <div className="w-12 h-12 border-4 border-teal-200 border-t-teal-600 rounded-full animate-spin" />
      </div>
    );
  }

  if (user?.role === 'admin') {
    return <Navigate to="/" replace />;
  }

  if (!isFieldRole(user?.role)) {
    return <Navigate to="/login" replace />;
  }

  return <Outlet />;
}
