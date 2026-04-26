import { Link, Outlet, useLocation } from 'react-router-dom';
import { Camera, Home, BookOpen, Users } from 'lucide-react';
import { useAuth } from '@/lib/AuthContext';
import { base44 } from '@/api/base44Client';
import { cn } from '@/lib/utils';

const nav = [
  { to: '/field', label: 'Trang chủ', icon: Home, end: true },
  { to: '/field/log', label: 'Nhật ký', icon: BookOpen, end: false },
  { to: '/field/household', label: 'Hộ nuôi', icon: Users, end: false },
];

function NavLink({ to, label, icon: Icon, active }) {
  return (
    <Link
      to={to}
      className={cn(
        'flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-semibold transition-colors',
        active
          ? 'bg-teal-600 text-white shadow-md shadow-teal-600/20'
          : 'text-stone-800 hover:bg-stone-100 border border-transparent hover:border-stone-200'
      )}
    >
      <Icon className={cn('w-5 h-5 shrink-0', active ? 'text-white' : 'text-stone-700')} strokeWidth={2} />
      {label}
    </Link>
  );
}

/** Hiện trường: mobile = header + bottom bar; desktop = sidebar + vùng nội dung rộng. */
export default function FieldLayout() {
  const { user } = useAuth();
  const location = useLocation();

  const handleLogout = async () => {
    await base44.auth.logout('/login');
  };

  const scanActive = location.pathname.startsWith('/field/scan');

  const sidebarInner = (
    <>
      <div className="px-1 pb-4 border-b border-stone-200">
        <p className="inline-flex text-[10px] font-extrabold text-teal-950 uppercase tracking-[0.12em] bg-teal-100 border border-teal-200/80 px-2 py-1 rounded-md">
          Hiện trường
        </p>
        <p className="text-base font-bold text-stone-900 mt-2 leading-snug break-words">
          {user?.name || user?.profile?.phone || 'Xin chào'}
        </p>
      </div>
      <nav className="flex flex-col gap-1 py-4">
        {nav.map(({ to, label, icon, end }) => {
          const active = end ? location.pathname === to : location.pathname.startsWith(to) && to !== '/field/scan';
          return <NavLink key={to} to={to} label={label} icon={icon} active={active} />;
        })}
        <Link
          to="/field/scan"
          className={cn(
            'flex items-center justify-center gap-2 rounded-xl px-3 py-3 text-sm font-bold transition-colors mt-2 border-2 shadow-sm',
            scanActive
              ? 'bg-teal-700 text-white border-teal-800 shadow-md'
              : 'bg-white text-teal-900 border-teal-600 hover:bg-teal-50'
          )}
        >
          <Camera className={cn('w-5 h-5', scanActive ? 'text-white' : 'text-teal-700')} strokeWidth={2.25} />
          Quét QR
        </Link>
      </nav>
      <button
        type="button"
        onClick={handleLogout}
        className="mt-auto w-full text-left text-sm font-semibold text-stone-600 border border-stone-200 bg-stone-50 hover:bg-stone-100 hover:text-stone-900 px-3 py-2.5 rounded-xl"
      >
        Thoát
      </button>
    </>
  );

  return (
    <div className="min-h-[100dvh] bg-stone-100 text-stone-900">
      <div className="md:flex md:min-h-[100dvh]">
        <aside className="hidden md:flex md:w-56 md:shrink-0 md:flex-col md:sticky md:top-0 md:h-screen md:border-r md:border-stone-200/80 md:bg-stone-50/80 md:backdrop-blur-sm md:px-3 md:py-5">
          {sidebarInner}
        </aside>

        <div className="flex-1 flex flex-col min-w-0 pb-[5.5rem] md:pb-0">
          <header className="sticky top-0 z-30 md:hidden border-b border-stone-200 bg-white shadow-sm px-4 py-3.5 flex items-center justify-between gap-2">
            <div className="min-w-0">
              <p className="text-[10px] font-extrabold text-teal-950 uppercase tracking-[0.12em]">Hiện trường</p>
              <p className="text-base font-bold text-stone-900 truncate leading-tight mt-0.5">
                {user?.name || user?.profile?.phone || 'Xin chào'}
              </p>
            </div>
            <button
              type="button"
              onClick={handleLogout}
              className="shrink-0 text-sm font-semibold text-stone-800 border border-stone-300 bg-white px-3 py-2 rounded-xl shadow-sm hover:bg-stone-50"
            >
              Thoát
            </button>
          </header>

          <main className="px-4 py-5 md:px-8 md:py-8 w-full max-w-6xl mx-auto flex-1">
            <Outlet />
          </main>
        </div>
      </div>

      <nav className="md:hidden fixed bottom-0 left-0 right-0 z-40 bg-white border-t border-stone-200 shadow-[0_-4px_20px_rgba(0,0,0,0.08)] flex items-end justify-between px-1 pt-1 pb-[max(0.5rem,env(safe-area-inset-bottom))]">
        {nav.map(({ to, label, icon: Icon, end }) => {
          const active = end ? location.pathname === to : location.pathname.startsWith(to);
          return (
            <Link
              key={to}
              to={to}
              className={cn(
                'flex flex-col items-center justify-center gap-0.5 py-2 px-1.5 min-w-[3.75rem] rounded-xl text-[11px] font-semibold transition-colors',
                active ? 'text-teal-800 bg-teal-50' : 'text-stone-700 hover:text-stone-900 hover:bg-stone-100'
              )}
            >
              <Icon className={cn('w-6 h-6', active && 'stroke-[2.25px]')} />
              <span className="leading-tight text-center">{label}</span>
            </Link>
          );
        })}
        <Link
          to="/field/scan"
          className={cn(
            'flex flex-col items-center justify-center gap-1 py-2.5 px-4 min-w-[4.5rem] -mt-4 mx-0.5 rounded-2xl text-[11px] font-bold shadow-lg active:scale-[0.98] transition-transform border-2',
            scanActive
              ? 'bg-teal-700 text-white border-teal-800'
              : 'bg-white text-teal-900 border-teal-600 shadow-stone-300/60'
          )}
        >
          <Camera className={cn('w-7 h-7', scanActive ? 'text-white' : 'text-teal-700')} strokeWidth={2.25} />
          <span className="leading-tight text-center">Quét QR</span>
        </Link>
      </nav>
    </div>
  );
}
