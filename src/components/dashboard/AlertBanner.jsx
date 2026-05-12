import { AlertTriangle, Clock, Pill, ChevronRight } from 'lucide-react';
import { differenceInDays, parseISO, format } from 'date-fns';
import { Link } from 'react-router-dom';
import { plannedHarvestDateForDisplay } from '@/lib/planReportHelpers';
import { calendarDaysUntilHarvest, isHarvestDateOnOrBeforeToday } from '@/lib/harvestAlerts';

function AlertItem({ pond, type }) {
  const today = new Date();
  
  if (type === 'harvest') {
    const dk = plannedHarvestDateForDisplay(pond);
    const diff = calendarDaysUntilHarvest(dk, today);
    const isOverdue = diff != null && diff < 0;
    const colorClass = isOverdue 
      ? 'bg-red-50 border-red-200 text-red-800' 
      : 'bg-yellow-50 border-yellow-200 text-yellow-800';
    const Icon = isOverdue ? AlertTriangle : Clock;
    const iconColor = isOverdue ? 'text-red-500' : 'text-yellow-500';
    
    return (
      <div className={`flex items-center gap-3 px-4 py-3 rounded-lg border ${colorClass} ${isOverdue ? 'pulse-urgent' : ''}`}>
        <Icon className={`w-4 h-4 flex-shrink-0 ${iconColor}`} />
        <div className="flex-1 min-w-0">
          <span className="font-semibold text-sm">[{pond.code}]</span>
          <span className="text-sm ml-2">{pond.owner_name}</span>
          <span className="text-xs ml-2 opacity-75">
            {isOverdue 
              ? `Quá hạn ${Math.abs(diff)} ngày` 
              : `Đến hạn thu (${format(parseISO(String(dk).slice(0, 10)), 'dd/MM')})`
            }
          </span>
        </div>
        <span className={`text-xs font-bold px-2 py-0.5 rounded ${isOverdue ? 'bg-red-500 text-white' : 'bg-yellow-400 text-yellow-900'}`}>
          {isOverdue ? 'QUÁ HẠN' : 'ĐẾN HẠN'}
        </span>
      </div>
    );
  }

  if (type === 'withdrawal') {
    const diff = differenceInDays(parseISO(pond.withdrawal_end_date), today);
    return (
      <div className="flex items-center gap-3 px-4 py-3 rounded-lg border bg-orange-50 border-orange-200 text-orange-800">
        <Pill className="w-4 h-4 flex-shrink-0 text-orange-500" />
        <div className="flex-1 min-w-0">
          <span className="font-semibold text-sm">[{pond.code}]</span>
          <span className="text-sm ml-2">{pond.owner_name}</span>
          <span className="text-xs ml-2 opacity-75">
            Còn {diff} ngày ngưng thuốc — chưa được thu hoạch
          </span>
        </div>
        <span className="text-xs font-bold px-2 py-0.5 rounded bg-orange-500 text-white">NGƯNG THUỐC</span>
      </div>
    );
  }
  
  return null;
}

export default function AlertBanner({ ponds }) {
  const today = new Date();
  const alerts = [];

  ponds.forEach(p => {
    const dk = plannedHarvestDateForDisplay(p);
    if (p.status === 'CC' && dk) {
      const diff = calendarDaysUntilHarvest(dk, today);
      if (isHarvestDateOnOrBeforeToday(diff)) alerts.push({ pond: p, type: 'harvest', diff });
    }
    if (p.withdrawal_end_date) {
      const wDiff = differenceInDays(parseISO(p.withdrawal_end_date), today);
      if (wDiff >= 0 && wDiff <= 5) alerts.push({ pond: p, type: 'withdrawal', diff: wDiff });
    }
  });

  alerts.sort((a, b) => a.diff - b.diff);

  if (alerts.length === 0) return null;

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold text-foreground flex items-center gap-2">
          <AlertTriangle className="w-4 h-4 text-red-500" />
          Cảnh báo ({alerts.length})
        </h3>
        <Link to="/ponds" className="text-xs text-accent hover:underline flex items-center gap-1">
          Xem tất cả <ChevronRight className="w-3 h-3" />
        </Link>
      </div>
      <div className="space-y-2 max-h-48 overflow-y-auto">
        {alerts.map((a, i) => (
          <AlertItem key={i} pond={a.pond} type={a.type} />
        ))}
      </div>
    </div>
  );
}