import { useEffect, useState } from 'react';
import { Navigate, useLocation, useNavigate, useSearchParams } from 'react-router-dom';
import { base44, isSupabaseConfigured } from '@/api/base44Client';
import { useAuth } from '@/lib/AuthContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Fish, LogIn } from 'lucide-react';
import { formatSupabaseError } from '@/lib/supabaseErrors';
import { normalizeVnPhone, isFieldRole } from '@/lib/fieldAuthHelpers';

function looksLikeEmail(s) {
  const t = String(s).trim();
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(t);
}

export default function Login() {
  const { user, isAuthenticated, isLoadingAuth, isLoadingPublicSettings, checkUserAuth } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();
  const from = location.state?.from || '/';

  const [identifier, setIdentifier] = useState('');
  const [password, setPassword] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    document.title = 'Đăng nhập';
  }, []);

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

  if (isAuthenticated && !user?.fieldSession) {
    if (isFieldRole(user?.role)) {
      return <Navigate to="/field" replace />;
    }
    return <Navigate to={from} replace />;
  }

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    const idRaw = identifier.trim();
    if (!idRaw || !password) {
      setError('Nhập email hoặc số điện thoại và mật khẩu');
      return;
    }
    setSubmitting(true);
    try {
      if (looksLikeEmail(idRaw)) {
        await base44.auth.signInWithPassword(idRaw, password);
        base44.auth.clearDevLoggedOutFlag();
        await checkUserAuth({ silent: true });
        const me = await base44.auth.me();
        if (isFieldRole(me?.role)) {
          navigate('/field', { replace: true });
        } else {
          navigate(from, { replace: true });
        }
      } else {
        const norm = normalizeVnPhone(idRaw);
        if (!norm || norm.length < 10) {
          setError('Số điện thoại không hợp lệ. Tài khoản văn phòng dùng địa chỉ email.');
          setSubmitting(false);
          return;
        }
        await base44.auth.signInWithFieldAccount(norm, password);
        base44.auth.clearDevLoggedOutFlag();
        await checkUserAuth({ silent: true });
        const me = await base44.auth.me();
        if (!isFieldRole(me?.role)) {
          setError('Tài khoản này không có quyền hiện trường.');
          await base44.auth.signOut();
          await checkUserAuth({ silent: true });
          setSubmitting(false);
          return;
        }
        const dest = typeof from === 'string' && from.startsWith('/field') ? from : '/field';
        navigate(dest, { replace: true });
      }
    } catch (err) {
      setError(formatSupabaseError(err));
    }
    setSubmitting(false);
  };

  const fieldSessionActive = isAuthenticated && user?.fieldSession;

  return (
    <div className="min-h-screen flex items-center justify-center p-4 bg-[hsl(213,65%,18%)]">
      <div className="w-full max-w-md rounded-2xl border border-blue-900/50 bg-[hsl(213,55%,22%)] shadow-xl p-8 space-y-6">
        <div className="flex flex-col items-center text-center gap-2">
          <div className="w-12 h-12 rounded-xl bg-blue-400/20 flex items-center justify-center">
            <Fish className="w-6 h-6 text-blue-300" />
          </div>
          <h1 className="text-xl font-bold text-white tracking-tight">Đăng nhập</h1>
          <p className="text-sm text-slate-300 leading-snug max-w-xs">
            Một ô duy nhất: <strong className="text-white font-semibold">email</strong> (văn phòng) hoặc{' '}
            <strong className="text-white font-semibold">số điện thoại</strong> (hiện trường), cùng mật khẩu.
          </p>
        </div>

        {fieldSessionActive ? (
          <div className="rounded-xl border border-teal-400/40 bg-teal-950/40 px-4 py-3 text-sm text-teal-50 space-y-3">
            <p>
              Trình duyệt đang giữ <strong>phiên hiện trường</strong>
              {user?.name ? ` (${user.name})` : ''} — nên mở app sẽ vào phần hiện trường, không phải quản lý.
            </p>
            <div className="flex flex-col sm:flex-row gap-2">
              <Button
                type="button"
                variant="secondary"
                className="flex-1 bg-white/15 text-white hover:bg-white/25 border-0"
                onClick={() => navigate('/field', { replace: true })}
              >
                Tiếp tục hiện trường
              </Button>
              <Button
                type="button"
                variant="outline"
                className="flex-1 border-teal-200/60 text-teal-50 bg-transparent hover:bg-white/10"
                onClick={() => {
                  base44.auth.clearFieldSession();
                  void checkUserAuth({ silent: true });
                }}
              >
                Thoát phiên hiện trường
              </Button>
            </div>
            <p className="text-xs text-teal-200/80">
              Muốn vào quản lý: bấm <strong>Thoát phiên hiện trường</strong>, rồi đăng nhập bằng <strong>email</strong>. Hoặc mở{' '}
              <code className="rounded bg-black/30 px-1">/login?office=1</code>.
            </p>
          </div>
        ) : null}

        <form onSubmit={handleSubmit} className="space-y-4">
          {error ? (
            <p className="text-sm text-red-200 bg-red-950/40 border border-red-800/50 rounded-lg px-3 py-2">{error}</p>
          ) : null}
          <div>
            <Label htmlFor="login-identifier" className="text-slate-100 text-xs font-semibold">
              Email hoặc số điện thoại
            </Label>
            <Input
              id="login-identifier"
              type="text"
              name="username"
              autoComplete="username"
              value={identifier}
              onChange={(e) => setIdentifier(e.target.value)}
              className="mt-1.5 h-12 text-base bg-[hsl(213,45%,18%)] border-slate-500/50 text-white placeholder:text-slate-400"
              placeholder="email@congty.com hoặc 0987 654 321"
            />
          </div>
          <div>
            <Label htmlFor="login-password" className="text-slate-100 text-xs font-semibold">
              Mật khẩu
            </Label>
            <Input
              id="login-password"
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
            <LogIn className="w-4 h-4 mr-2" />
            {submitting ? 'Đang đăng nhập…' : 'Đăng nhập'}
          </Button>
        </form>
      </div>
    </div>
  );
}
