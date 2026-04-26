import { Navigate, Outlet, useLocation } from 'react-router-dom';
import { useAuth } from '@/lib/AuthContext';

/** Chỉ đại lý / chủ hộ vào /field. Admin → trang chủ văn phòng */
export default function FieldRoleGate() {
  const { user, isLoadingAuth } = useAuth();
  const location = useLocation();

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

  if (user?.role !== 'agency' && user?.role !== 'household_owner') {
    return <Navigate to="/login" replace />;
  }

  return <Outlet />;
}
