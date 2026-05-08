import { Link, useLocation } from 'react-router-dom';
import { 
  LayoutDashboard, Fish, ClipboardList, BarChart3, 
  Building2, Factory, ChevronRight, ChevronLeft, Menu, Settings, LogOut, UserPlus,
} from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { useAuth } from '@/lib/AuthContext';

const baseNavItems = [
  { path: '/', icon: LayoutDashboard, label: 'Tổng quan' },
  { path: '/ponds', icon: Fish, label: 'Quản lý ao' },
  { path: '/logs', icon: ClipboardList, label: 'Nhật ký' },
  { path: '/reports', icon: BarChart3, label: 'Báo cáo' },
  { path: '/factory-plan', icon: Factory, label: 'Kế hoạch nhà máy' },
  { path: '/agencies', icon: Building2, label: 'Đại lý' },
];

export default function Sidebar({ alertCount = 0, collapsed, onToggle }) {
  const { user, logout } = useAuth();
  const initials = (user?.name || user?.email || '?')
    .split(/\s|@/)
    .filter(Boolean)
    .slice(0, 2)
    .map((s) => s[0]?.toUpperCase())
    .join('')
    .slice(0, 2) || '?';
  const location = useLocation();
  const navItems = user?.role === 'admin'
    ? [...baseNavItems, { path: '/admin', icon: UserPlus, label: 'Tài khoản hiện trường' }, { path: '/settings', icon: Settings, label: 'Cài đặt' }]
    : baseNavItems;

  return (
    <aside
      className="fixed top-0 left-0 h-full flex flex-col z-40 transition-all duration-200"
      style={{
        background: 'hsl(var(--sidebar-background))',
        width: collapsed ? '64px' : '220px',
      }}
    >
      {/* Logo + toggle */}
      <div className="px-3 py-4 border-b flex items-center justify-between" style={{ borderColor: 'hsl(var(--sidebar-border))' }}>
        {!collapsed && (
          <div className="flex items-center gap-2 overflow-hidden">
            <div className="w-8 h-8 rounded-lg bg-blue-400/20 flex items-center justify-center flex-shrink-0">
              <Fish className="w-4 h-4 text-blue-300" />
            </div>
            <div className="min-w-0">
              <p className="text-white font-bold text-sm tracking-wide leading-none">AQUA</p>
              <p className="text-blue-300/70 text-xs font-medium">MANAGEMENT</p>
            </div>
          </div>
        )}
        {collapsed && (
          <div className="w-8 h-8 rounded-lg bg-blue-400/20 flex items-center justify-center mx-auto">
            <Fish className="w-4 h-4 text-blue-300" />
          </div>
        )}
        <button
          onClick={onToggle}
          className={`text-blue-300/60 hover:text-white transition-colors flex-shrink-0 ${collapsed ? 'hidden' : ''}`}
        >
          <ChevronLeft className="w-4 h-4" />
        </button>
      </div>

      {/* Expand button when collapsed */}
      {collapsed && (
        <button
          onClick={onToggle}
          className="mt-2 mx-auto text-blue-300/60 hover:text-white transition-colors"
          title="Mở rộng"
        >
          <Menu className="w-5 h-5" />
        </button>
      )}

      {/* Nav */}
      <nav className="flex-1 px-2 py-3 space-y-1 overflow-y-auto">
        {navItems.map((item) => {
          const active = location.pathname === item.path;
          return (
            <Link
              key={item.path}
              to={item.path}
              title={collapsed ? item.label : undefined}
              className={`flex items-center gap-3 px-2.5 py-2.5 rounded-lg transition-all duration-150 group ${
                active ? 'text-white' : 'text-blue-200/70 hover:text-white'
              } ${collapsed ? 'justify-center' : ''}`}
              style={active ? { background: 'hsl(var(--sidebar-accent))' } : {}}
            >
              <div className="relative flex-shrink-0">
                <item.icon
                  className={`${active ? 'text-blue-300' : 'text-blue-400/60 group-hover:text-blue-300'}`}
                  style={{ width: '1.125rem', height: '1.125rem' }}
                />
                {item.path === '/' && alertCount > 0 && collapsed && (
                  <span className="absolute -top-1 -right-1 w-2 h-2 bg-red-500 rounded-full" />
                )}
              </div>
              {!collapsed && (
                <>
                  <span className="text-sm font-medium flex-1">{item.label}</span>
                  {item.path === '/' && alertCount > 0 && (
                    <Badge className="bg-red-500 text-white text-xs px-1.5 py-0 h-5 min-w-5 flex items-center justify-center">
                      {alertCount}
                    </Badge>
                  )}
                  {active && <ChevronRight className="w-3.5 h-3.5 text-blue-400" />}
                </>
              )}
            </Link>
          );
        })}
      </nav>

      {/* Footer */}
      {!collapsed && (
        <div className="px-3 py-3 border-t space-y-2" style={{ borderColor: 'hsl(var(--sidebar-border))' }}>
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 rounded-full bg-blue-400/20 flex items-center justify-center flex-shrink-0">
              <span className="text-blue-300 text-xs font-bold">{initials}</span>
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-white text-xs font-semibold truncate">{user?.name || 'Người dùng'}</p>
              <p className="text-blue-300/60 text-xs truncate">{user?.email || user?.role || ''}</p>
            </div>
          </div>
          <button
            type="button"
            onClick={() => logout(true)}
            className="flex items-center gap-2 w-full rounded-lg px-2 py-2 text-xs text-blue-200/80 hover:text-white hover:bg-white/5 transition-colors"
          >
            <LogOut className="w-3.5 h-3.5 flex-shrink-0" />
            Đăng xuất
          </button>
        </div>
      )}
    </aside>
  );
}