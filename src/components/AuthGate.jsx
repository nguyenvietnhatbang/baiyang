import { Navigate, Outlet, useLocation } from 'react-router-dom';
import { isSupabaseConfigured } from '@/api/base44Client';
import { useAuth } from '@/lib/AuthContext';
import UserNotRegisteredError from '@/components/UserNotRegisteredError';

function FullPageLoading() {
  return (
    <div className="fixed inset-0 flex items-center justify-center" style={{ background: 'hsl(213,65%,18%)' }}>
      <div className="text-center">
        <div className="w-10 h-10 border-4 border-blue-400/30 border-t-blue-400 rounded-full animate-spin mx-auto mb-4" />
        <p className="text-blue-200 text-sm font-medium">Đang tải hệ thống...</p>
      </div>
    </div>
  );
}

export default function AuthGate() {
  const { isLoadingAuth, isLoadingPublicSettings, isAuthenticated, authError } = useAuth();
  const location = useLocation();

  if (isLoadingPublicSettings || isLoadingAuth) {
    return <FullPageLoading />;
  }

  if (authError?.type === 'user_not_registered') {
    return <UserNotRegisteredError />;
  }

  if (authError?.type === 'unknown') {
    return (
      <div className="min-h-screen flex items-center justify-center p-6 bg-background">
        <div className="max-w-md rounded-xl border border-destructive/30 bg-destructive/5 p-6 text-center">
          <p className="text-sm text-destructive font-medium">Không tải được phiên đăng nhập</p>
          <p className="text-xs text-muted-foreground mt-2">{authError.message}</p>
        </div>
      </div>
    );
  }

  if (isSupabaseConfigured && !isAuthenticated) {
    const fieldPaths = location.pathname.startsWith('/field');
    const loginPath = fieldPaths ? '/login' : '/login?mode=office';
    return <Navigate to={loginPath} replace state={{ from: location.pathname }} />;
  }

  return <Outlet />;
}
