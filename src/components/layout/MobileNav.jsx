import { Link, useLocation } from 'react-router-dom';
import { LayoutDashboard, Fish, ClipboardList, BarChart3, Building2, Settings, UserPlus } from 'lucide-react';
import { useAuth } from '@/lib/AuthContext';

const baseNavItems = [
  { path: '/', icon: LayoutDashboard, label: 'Tổng quan' },
  { path: '/ponds', icon: Fish, label: 'Ao' },
  { path: '/logs', icon: ClipboardList, label: 'Nhật ký' },
  { path: '/reports', icon: BarChart3, label: 'BC' },
  { path: '/agencies', icon: Building2, label: 'ĐL' },
];

export default function MobileNav({ alertCount = 0 }) {
  const { user } = useAuth();
  const location = useLocation();
  const navItems = user?.role === 'admin'
    ? [...baseNavItems, { path: '/admin', icon: UserPlus, label: 'Hiện trường' }, { path: '/settings', icon: Settings, label: 'Cài đặt' }]
    : baseNavItems;
  return (
    <nav
      className="fixed bottom-0 left-0 right-0 z-40 sm:hidden border-t border-border flex overflow-x-auto"
      style={{ background: 'hsl(var(--sidebar-background))' }}
    >
      {navItems.map(item => {
        const active = location.pathname === item.path;
        return (
          <Link
            key={item.path}
            to={item.path}
            className={`flex flex-col items-center justify-center py-2 gap-0.5 relative transition-colors flex-shrink-0 min-w-[4.25rem] ${
              active ? 'text-white' : 'text-blue-300/60'
            }`}
          >
            <item.icon style={{ width: '1.125rem', height: '1.125rem' }} />
            <span className="text-[10px] font-medium">{item.label}</span>
            {item.path === '/' && alertCount > 0 && (
              <span className="absolute top-1 right-1/4 w-2 h-2 bg-red-500 rounded-full" />
            )}
            {active && <span className="absolute bottom-0 left-1/4 right-1/4 h-0.5 bg-blue-400 rounded-t" />}
          </Link>
        );
      })}
    </nav>
  );
}