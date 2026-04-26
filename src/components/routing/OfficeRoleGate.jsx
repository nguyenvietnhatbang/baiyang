import { Navigate, Outlet, useLocation } from 'react-router-dom';
import { useAuth } from '@/lib/AuthContext';
import { isFieldRole } from '@/lib/fieldAuthHelpers';

/** Chỉ admin dùng bảng điều khiển văn phòng + /admin. Đại lý/chủ hộ → /field */
export default function OfficeRoleGate() {
  const { user, isLoadingAuth } = useAuth();
  const location = useLocation();

  if (isLoadingAuth) {
    return (
      <div className="fixed inset-0 flex items-center justify-center bg-[hsl(213,65%,18%)]">
        <div className="w-10 h-10 border-4 border-blue-400/30 border-t-blue-400 rounded-full animate-spin" />
      </div>
    );
  }

  if (user && isFieldRole(user.role)) {
    return <Navigate to="/field" replace state={{ from: location.pathname }} />;
  }

  return <Outlet />;
}
