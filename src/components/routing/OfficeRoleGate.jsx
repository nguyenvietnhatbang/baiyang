import { Navigate, Outlet, useLocation } from 'react-router-dom';
import { useAuth } from '@/lib/AuthContext';
import { isFieldRole } from '@/lib/fieldAuthHelpers';

/** Admin: toàn bộ văn phòng. Vai trò hiện trường (văn phòng): /ponds, /scan, /logs. */
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
    const path = location.pathname;
    const allowed =
      path === '/ponds' ||
      path.startsWith('/ponds/') ||
      path === '/scan' ||
      path === '/logs';
    if (!allowed) {
      return <Navigate to="/ponds" replace />;
    }
  }

  return <Outlet />;
}
