import { useEffect, useState } from 'react';
import { Navigate, useLocation, useNavigate, useSearchParams } from 'react-router-dom';
import { base44, isSupabaseConfigured } from '@/api/base44Client';
import { useAuth } from '@/lib/AuthContext';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Fish, LogIn } from 'lucide-react';
import { formatSupabaseError } from '@/lib/supabaseErrors';
import { normalizeVnPhone, isFieldRole } from '@/lib/fieldAuthHelpers';

export default function Login() {
  const { user, isAuthenticated, isLoadingAuth, isLoadingPublicSettings, checkUserAuth } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const from = location.state?.from || '/';

  /** Mặc định: Hiện trường. Chỉ khi ?mode=office mới form email. */
  const [mode, setMode] = useState(() => (searchParams.get('mode') === 'office' ? 'office' : 'field'));

  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [password, setPassword] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    setMode(searchParams.get('mode') === 'office' ? 'office' : 'field');
  }, [searchParams]);

  const setLoginMode = (next) => {
    setMode(next);
    setError('');
    setPassword('');
    if (next === 'office') {
      setSearchParams({ mode: 'office' }, { replace: true });
    } else {
      setSearchParams({}, { replace: true });
    }
  };

  if (!isSupabaseConfigured) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center p-6 bg-[hsl(213,65%,18%)] text-blue-100">
        <Fish className="w-12 h-12 text-blue-300 mb-4" />
        <p className="text-center text-sm">Ứng dụng chưa được cấu hình.</p>
        {import.meta.env.DEV ? (
          <p className="text-center max-w-md text-xs text-blue-200/70 mt-3">
            Thêm <code className="text-blue-100">VITE_SUPABASE_URL</code> và <code className="text-blue-100">VITE_SUPABASE_ANON_KEY</code> vào{' '}
            <code className="text-blue-100">.env</code>, rồi chạy lại dev server.
          </p>
        ) : null}
      </div>
    );
  }

  if (isLoadingPublicSettings || isLoadingAuth) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[hsl(213,65%,18%)]">
        <div className="w-10 h-10 border-4 border-blue-400/30 border-t-blue-400 rounded-full animate-spin" />
      </div>
    );
  }

  if (isAuthenticated) {
    if (isFieldRole(user?.role)) {
      return <Navigate to="/field" replace />;
    }
    return <Navigate to={from} replace />;
  }

  const handleOfficeSubmit = async (e) => {
    e.preventDefault();
    setError('');
    if (!email.trim() || !password) {
      setError('Nhập email và mật khẩu');
      return;
    }
    setSubmitting(true);
    try {
      await base44.auth.signInWithPassword(email, password);
      base44.auth.clearDevLoggedOutFlag();
      await checkUserAuth();
      const me = await base44.auth.me();
      if (isFieldRole(me?.role)) {
        navigate('/field', { replace: true });
      } else {
        navigate(from, { replace: true });
      }
    } catch (err) {
      setError(formatSupabaseError(err));
    }
    setSubmitting(false);
  };

  const handleFieldSubmit = async (e) => {
    e.preventDefault();
    setError('');
    const norm = normalizeVnPhone(phone);
    if (!norm || norm.length < 10) {
      setError('Số điện thoại không hợp lệ');
      return;
    }
    if (!password) {
      setError('Nhập mật khẩu');
      return;
    }
    setSubmitting(true);
    try {
      await base44.auth.signInWithFieldAccount(norm, password);
      base44.auth.clearDevLoggedOutFlag();
      await checkUserAuth();
      const me = await base44.auth.me();
      if (!isFieldRole(me?.role)) {
        setError('Không có quyền truy cập');
        await base44.auth.signOut();
        await checkUserAuth();
        return;
      }
      const dest = from.startsWith('/field') ? from : '/field';
      navigate(dest, { replace: true });
    } catch (err) {
      setError(formatSupabaseError(err));
    }
    setSubmitting(false);
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-4 bg-[hsl(213,65%,18%)]">
      <div className="w-full max-w-md rounded-2xl border border-blue-900/50 bg-[hsl(213,55%,22%)] shadow-xl p-8 space-y-6">
        <div className="flex flex-col items-center text-center gap-2">
          <div className="w-12 h-12 rounded-xl bg-blue-400/20 flex items-center justify-center">
            <Fish className="w-6 h-6 text-blue-300" />
          </div>
          <h1 className="text-xl font-bold text-white tracking-tight">Đăng nhập</h1>
        </div>

        <div className="grid grid-cols-2 gap-2 p-1 rounded-xl bg-[hsl(213,48%,11%)] border border-blue-800/50">
          <button
            type="button"
            onClick={() => setLoginMode('field')}
            className={cn(
              'rounded-lg py-2.5 text-sm font-semibold transition-colors',
              mode === 'field' ? 'bg-teal-500 text-white shadow' : 'text-slate-200 hover:text-white hover:bg-white/10'
            )}
          >
            Hiện trường
          </button>
          <button
            type="button"
            onClick={() => setLoginMode('office')}
            className={cn(
              'rounded-lg py-2.5 text-sm font-semibold transition-colors',
              mode === 'office' ? 'bg-blue-500 text-white shadow' : 'text-slate-200 hover:text-white hover:bg-white/10'
            )}
          >
            Văn phòng
          </button>
        </div>

        {mode === 'office' ? (
          <form onSubmit={handleOfficeSubmit} className="space-y-4">
            {error ? (
              <p className="text-sm text-red-200 bg-red-950/40 border border-red-800/50 rounded-lg px-3 py-2">{error}</p>
            ) : null}
            <div>
              <Label htmlFor="login-email" className="text-slate-100 text-xs font-semibold">
                Email
              </Label>
              <Input
                id="login-email"
                type="email"
                autoComplete="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="mt-1.5 bg-[hsl(213,45%,18%)] border-slate-500/50 text-white placeholder:text-slate-400"
                placeholder="email@congty.com"
              />
            </div>
            <div>
              <Label htmlFor="login-password-office" className="text-slate-100 text-xs font-semibold">
                Mật khẩu
              </Label>
              <Input
                id="login-password-office"
                type="password"
                autoComplete="current-password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="mt-1.5 bg-[hsl(213,45%,18%)] border-slate-500/50 text-white"
              />
            </div>
            <Button
              type="submit"
              disabled={submitting}
              className="w-full bg-blue-500 hover:bg-blue-600 text-white font-medium"
            >
              <LogIn className="w-4 h-4 mr-2" />
              {submitting ? 'Đang đăng nhập…' : 'Đăng nhập'}
            </Button>
          </form>
        ) : (
          <form onSubmit={handleFieldSubmit} className="space-y-4">
            {error ? (
              <p className="text-sm text-red-200 bg-red-950/40 border border-red-800/50 rounded-lg px-3 py-2">{error}</p>
            ) : null}
            <div>
              <Label htmlFor="login-phone" className="text-slate-100 text-xs font-semibold">
                Số điện thoại
              </Label>
              <Input
                id="login-phone"
                type="tel"
                inputMode="tel"
                autoComplete="tel"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                className="mt-1.5 h-12 text-base bg-[hsl(213,45%,18%)] border-slate-500/50 text-white placeholder:text-slate-400"
                placeholder="0987 654 321"
              />
            </div>
            <div>
              <Label htmlFor="login-password-field" className="text-slate-100 text-xs font-semibold">
                Mật khẩu
              </Label>
              <Input
                id="login-password-field"
                type="password"
                autoComplete="current-password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="mt-1.5 h-12 text-base bg-[hsl(213,45%,18%)] border-slate-500/50 text-white"
              />
            </div>
            <Button
              type="submit"
              disabled={submitting}
              className="w-full h-12 bg-teal-600 hover:bg-teal-700 text-white font-medium"
            >
              {submitting ? 'Đang đăng nhập…' : 'Đăng nhập'}
            </Button>
          </form>
        )}
      </div>
    </div>
  );
}
