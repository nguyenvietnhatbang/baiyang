import { useState } from 'react';
import { Link, Navigate, useLocation, useNavigate } from 'react-router-dom';
import { base44, isSupabaseConfigured } from '@/api/base44Client';
import { useAuth } from '@/lib/AuthContext';
import { Button, buttonVariants } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Fish, LogIn } from 'lucide-react';
import { formatSupabaseError } from '@/lib/supabaseErrors';

export default function Login() {
  const { isAuthenticated, isLoadingAuth, isLoadingPublicSettings, checkUserAuth } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();
  const from = location.state?.from || '/';

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  if (!isSupabaseConfigured) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center p-6 bg-[hsl(213,65%,18%)] text-blue-100">
        <Fish className="w-12 h-12 text-blue-300 mb-4" />
        <p className="text-center max-w-md text-sm text-blue-200/90">
          Chưa cấu hình Supabase trong bundle hiện tại. Kiểm tra file <code className="text-blue-100">.env</code> ở thư mục gốc dự án có đúng{' '}
          <code className="text-blue-100">VITE_SUPABASE_URL</code> và <code className="text-blue-100">VITE_SUPABASE_ANON_KEY</code> (bắt buộc tiền tố{' '}
          <code className="text-blue-100">VITE_</code>). Sau khi sửa <code className="text-blue-100">.env</code>, hãy <strong className="text-blue-100">dừng và chạy lại</strong>{' '}
          <code className="text-blue-100">npm run dev</code> — Vite chỉ nạp biến môi trường khi khởi động dev server.
        </p>
        <Link
          to="/"
          onClick={() => base44.auth.clearDevLoggedOutFlag()}
          className={cn(
            buttonVariants({ variant: 'default' }),
            'mt-6 inline-flex bg-blue-500 hover:bg-blue-600 text-white'
          )}
        >
          Vào ứng dụng
        </Link>
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
    return <Navigate to={from} replace />;
  }

  const handleSubmit = async (e) => {
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
      navigate(from, { replace: true });
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
          <p className="text-sm text-blue-200/70">Quản lý ao nuôi — My Pond</p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          {error && (
            <p className="text-sm text-red-200 bg-red-950/40 border border-red-800/50 rounded-lg px-3 py-2">{error}</p>
          )}
          <div>
            <Label htmlFor="login-email" className="text-blue-200/80 text-xs uppercase font-semibold">
              Email
            </Label>
            <Input
              id="login-email"
              type="email"
              autoComplete="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="mt-1.5 bg-[hsl(213,50%,15%)] border-blue-900/40 text-white placeholder:text-blue-300/40"
              placeholder="admin@demo.mypond.local"
            />
          </div>
          <div>
            <Label htmlFor="login-password" className="text-blue-200/80 text-xs uppercase font-semibold">
              Mật khẩu
            </Label>
            <Input
              id="login-password"
              type="password"
              autoComplete="current-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="mt-1.5 bg-[hsl(213,50%,15%)] border-blue-900/40 text-white"
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

        <p className="text-xs text-center text-blue-300/50">
          Tài khoản admin mẫu: chạy <code className="text-blue-200/80">npm run seed:admin</code> (cần service role).
        </p>
      </div>
    </div>
  );
}
