import { Outlet } from 'react-router-dom';
import Sidebar from './Sidebar';
import MobileNav from './MobileNav';
import { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { differenceInDays, parseISO } from 'date-fns';
import { useIsMobile } from '@/hooks/use-mobile';
import { useAuth } from '@/lib/AuthContext';
import { plannedHarvestDateForDisplay } from '@/lib/planReportHelpers';
import { calendarDaysUntilHarvest, isHarvestDateOnOrBeforeToday } from '@/lib/harvestAlerts';

export default function AppLayout() {
  const { user, logout } = useAuth();
  const [alertCount, setAlertCount] = useState(0);
  const [collapsed, setCollapsed] = useState(false);
  const isMobile = useIsMobile();

  useEffect(() => {
    const loadAlerts = async () => {
      const ponds = await base44.entities.Pond.listWithHouseholds('-updated_at', 500);
      const today = new Date();
      let count = 0;
      ponds.forEach((p) => {
        if (p.status !== 'CC') return;
        const dk = plannedHarvestDateForDisplay(p);
        if (dk) {
          const diff = calendarDaysUntilHarvest(dk, today);
          if (isHarvestDateOnOrBeforeToday(diff)) count++;
        }
        if (p.withdrawal_end_date) {
          const wDiff = differenceInDays(parseISO(p.withdrawal_end_date), today);
          if (wDiff >= 0 && wDiff <= 3) count++;
        }
      });
      setAlertCount(count);
    };
    loadAlerts();
  }, []);

  const sidebarWidth = collapsed ? 64 : 220;

  return (
    <div className="flex min-h-screen bg-background">
      {/* Sidebar — desktop only */}
      {!isMobile && (
        <Sidebar alertCount={alertCount} collapsed={collapsed} onToggle={() => setCollapsed(c => !c)} />
      )}

      {/* Main content */}
      <main
        className="flex-1 overflow-auto pb-16 sm:pb-0 transition-all duration-200 flex flex-col"
        style={{ marginLeft: isMobile ? 0 : `${sidebarWidth}px` }}
      >
        {isMobile && (
          <header className="sticky top-0 z-30 flex items-center gap-2 px-3 py-2 border-b border-border bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/80">
            <span className="text-xs text-muted-foreground truncate flex-1 min-w-0">{user?.email || user?.name}</span>
            <button
              type="button"
              onClick={() => logout(true)}
              className="text-xs font-medium text-primary shrink-0"
            >
              Đăng xuất
            </button>
          </header>
        )}
        <div className="flex-1 min-h-0">
          <Outlet />
        </div>
      </main>

      {/* Bottom nav — mobile only */}
      {isMobile && <MobileNav alertCount={alertCount} />}
    </div>
  );
}