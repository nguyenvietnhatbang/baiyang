import { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { Fish, Package, TrendingUp, AlertTriangle, QrCode, Plus, Activity, BarChart3 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import StatCard from '@/components/dashboard/StatCard';
import AlertBanner from '@/components/dashboard/AlertBanner';
import HarvestChart from '@/components/dashboard/HarvestChart';
import { Link } from 'react-router-dom';
import { differenceInDays, parseISO } from 'date-fns';
import { plannedHarvestDateForDisplay } from '@/lib/planReportHelpers';
import { calendarDaysUntilHarvest, isHarvestDateOnOrBeforeToday } from '@/lib/harvestAlerts';

export default function Dashboard() {
  const [ponds, setPonds] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    base44.entities.Pond.listWithHouseholds('-updated_date', 200).then(data => {
      setPonds(data);
      setLoading(false);
    });
  }, []);

  const activePonds = ponds.filter(p => p.status === 'CC');
  const inactivePonds = ponds.filter(p => p.status === 'CT');
  const totalExpectedYield = activePonds.reduce((s, p) => s + (p.expected_yield || 0), 0);
  const totalActualYield = ponds.reduce((s, p) => s + (p.actual_yield || 0), 0);

  const today = new Date();
  const urgentPonds = activePonds.filter(p => {
    const dk = plannedHarvestDateForDisplay(p);
    if (!dk) return false;
    return isHarvestDateOnOrBeforeToday(calendarDaysUntilHarvest(dk, today));
  });

  const withdrawalAlerts = ponds.filter(p => {
    if (!p.withdrawal_end_date) return false;
    const d = differenceInDays(parseISO(p.withdrawal_end_date), today);
    return d >= 0 && d <= 5;
  });

  const avgFCR = activePonds.filter(p => p.fcr).length > 0
    ? (activePonds.reduce((s, p) => s + (p.fcr || 0), 0) / activePonds.filter(p => p.fcr).length).toFixed(2)
    : '—';

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="w-8 h-8 border-4 border-primary/30 border-t-primary rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Tổng quan hệ thống</h1>
          <p className="text-muted-foreground text-sm mt-0.5">
            {new Date().toLocaleDateString('vi-VN', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}
          </p>
        </div>
        <div className="flex gap-3">
          <Link to="/ponds">
            <Button variant="outline" className="flex items-center gap-2 text-sm">
              <Plus className="w-4 h-4" />
              Thêm ao mới
            </Button>
          </Link>
          <Link to="/logs">
            <Button className="bg-primary text-white flex items-center gap-2 text-sm">
              <QrCode className="w-4 h-4" />
              Quét QR / Nhập nhật ký
            </Button>
          </Link>
        </div>
      </div>

      {/* Alerts */}
      {(urgentPonds.length > 0 || withdrawalAlerts.length > 0) && (
        <AlertBanner
          ponds={[...urgentPonds, ...withdrawalAlerts.filter(p => !urgentPonds.includes(p))]}
        />
      )}

      {/* Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          label="Ao đang có cá (CC)"
          value={activePonds.length}
          sub={`${inactivePonds.length} ao chưa thả (CT)`}
          icon={Fish}
          color="blue"
        />
        <StatCard
          label="Sản lượng dự kiến"
          value={`${(totalExpectedYield / 1000).toFixed(1)}T`}
          sub={`${activePonds.length} ao đang nuôi`}
          icon={TrendingUp}
          color="green"
        />
        <StatCard
          label="Đã thu hoạch"
          value={`${(totalActualYield / 1000).toFixed(1)}T`}
          sub="Tổng sản lượng thực"
          icon={Package}
          color="purple"
        />
        <StatCard
          label="FCR trung bình"
          value={avgFCR}
          sub="Hệ số chuyển đổi thức ăn"
          icon={Activity}
          color={Number(avgFCR) > 1.5 ? 'orange' : 'green'}
        />
      </div>

      {/* Charts + Urgent Table */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Harvest Chart */}
        <div className="lg:col-span-2 bg-card rounded-xl border border-border p-5 shadow-sm">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h3 className="font-semibold text-foreground">Kế hoạch vs Thực tế</h3>
              <p className="text-xs text-muted-foreground">Sản lượng theo tháng (kg)</p>
            </div>
            <Link to="/reports">
              <Button variant="outline" size="sm" className="text-xs flex items-center gap-1">
                <BarChart3 className="w-3.5 h-3.5" />
                Báo cáo đầy đủ
              </Button>
            </Link>
          </div>
          <HarvestChart ponds={ponds} />
        </div>

        {/* Urgent Ponds */}
        <div className="bg-card rounded-xl border border-border p-5 shadow-sm">
          <div className="flex items-center gap-2 mb-4">
            <AlertTriangle className="w-4 h-4 text-red-500" />
            <h3 className="font-semibold text-foreground">Ưu tiên thu ({urgentPonds.length})</h3>
          </div>
          {urgentPonds.length === 0 ? (
            <div className="text-center py-8">
              <div className="w-12 h-12 rounded-full bg-green-50 flex items-center justify-center mx-auto mb-3">
                <Fish className="w-6 h-6 text-green-500" />
              </div>
              <p className="text-sm text-muted-foreground">Không có ao ưu tiên thu</p>
            </div>
          ) : (
            <div className="space-y-2">
              {urgentPonds.map(p => {
                const dk = plannedHarvestDateForDisplay(p);
                const diff = dk ? calendarDaysUntilHarvest(dk, today) : null;
                return (
                  <Link to="/ponds" key={p.id}>
                    <div className={`p-3 rounded-lg border cursor-pointer hover:shadow-sm transition-shadow ${
                      diff < 0 ? 'bg-red-50 border-red-200' : 'bg-yellow-50 border-yellow-200'
                    }`}>
                      <div className="flex justify-between items-start">
                        <div>
                          <p className="font-semibold text-sm text-foreground">{p.code}</p>
                          <p className="text-xs text-muted-foreground">{p.owner_name}</p>
                        </div>
                        <span className={`text-xs font-bold px-1.5 py-0.5 rounded ${
                          diff < 0 ? 'bg-red-500 text-white' : 'bg-yellow-400 text-yellow-900'
                        }`}>
                          {diff < 0 ? `+${Math.abs(diff)}d` : `${diff}d`}
                        </span>
                      </div>
                      <p className="text-xs text-muted-foreground mt-1">
                        DK: {p.expected_yield?.toLocaleString() || '—'} kg
                      </p>
                    </div>
                  </Link>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* FCR & Active Ponds Summary */}
      <div className="bg-card rounded-xl border border-border shadow-sm overflow-hidden">
        <div className="px-5 py-4 border-b border-border">
          <h3 className="font-semibold text-foreground">Tình trạng ao đang nuôi</h3>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm min-w-[600px]">
            <thead>
              <tr className="bg-muted/50">
                <th className="text-left px-4 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wide whitespace-nowrap">Mã ao</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wide whitespace-nowrap">Chủ hộ</th>
                <th className="text-right px-4 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wide whitespace-nowrap">Số cá</th>
                <th className="text-right px-4 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wide whitespace-nowrap">SL Dự kiến</th>
                <th className="text-center px-4 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wide whitespace-nowrap">FCR</th>
                <th className="text-center px-4 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wide whitespace-nowrap">Ngày thu DK</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {activePonds.slice(0, 8).map(p => {
                const dk = plannedHarvestDateForDisplay(p);
                const diff = dk ? calendarDaysUntilHarvest(dk, today) : null;
                return (
                  <tr key={p.id} className="hover:bg-muted/30 transition-colors">
                    <td className="px-4 py-3 font-medium text-primary whitespace-nowrap">{p.code}</td>
                    <td className="px-4 py-3 text-foreground whitespace-nowrap">{p.owner_name}</td>
                    <td className="px-4 py-3 text-right text-foreground whitespace-nowrap">{(p.current_fish || 0).toLocaleString()}</td>
                    <td className="px-4 py-3 text-right font-medium whitespace-nowrap">{(p.expected_yield || 0).toLocaleString()} kg</td>
                    <td className="px-4 py-3 text-center whitespace-nowrap">
                      {p.fcr ? (
                        <span className={`px-2 py-0.5 rounded text-xs font-semibold ${
                          p.fcr <= 1.3 ? 'bg-green-100 text-green-700' : 
                          p.fcr <= 1.6 ? 'bg-yellow-100 text-yellow-700' : 
                          'bg-red-100 text-red-700'
                        }`}>{p.fcr}</span>
                      ) : <span className="text-muted-foreground">—</span>}
                    </td>
                    <td className="px-4 py-3 text-center text-xs">
                      {dk ? (
                        <span className={diff !== null && diff <= 0 ? 'text-red-600 font-bold' : 'text-foreground'}>
                          {dk}
                          {diff !== null && diff <= 0 && <span className="ml-1 text-red-500 text-xs">(Quá hạn)</span>}
                        </span>
                      ) : '—'}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}