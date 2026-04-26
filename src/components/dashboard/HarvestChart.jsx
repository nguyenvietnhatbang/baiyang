import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';

export default function HarvestChart({ ponds }) {
  // Build monthly planned vs actual data
  const monthlyData = {};
  const months = ['T1','T2','T3','T4','T5','T6','T7','T8','T9','T10','T11','T12'];
  months.forEach(m => { monthlyData[m] = { month: m, keHoach: 0, thucTe: 0 }; });

  ponds.forEach(p => {
    if (p.expected_harvest_date) {
      const m = months[new Date(p.expected_harvest_date).getMonth()];
      if (m && monthlyData[m]) monthlyData[m].keHoach += (p.expected_yield || 0);
    }
    if (p.actual_yield) {
      const m = p.expected_harvest_date 
        ? months[new Date(p.expected_harvest_date).getMonth()]
        : months[new Date().getMonth()];
      if (m && monthlyData[m]) monthlyData[m].thucTe += p.actual_yield;
    }
  });

  const data = months.map(m => monthlyData[m]);

  return (
    <ResponsiveContainer width="100%" height={220}>
      <BarChart data={data} margin={{ top: 4, right: 8, left: -10, bottom: 0 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
        <XAxis dataKey="month" tick={{ fontSize: 11 }} />
        <YAxis tick={{ fontSize: 11 }} />
        <Tooltip 
          formatter={(v, n) => [`${v.toLocaleString()} kg`, n === 'keHoach' ? 'Kế hoạch' : 'Thực tế']}
          contentStyle={{ borderRadius: '8px', fontSize: '12px' }}
        />
        <Legend formatter={(v) => v === 'keHoach' ? 'Kế hoạch' : 'Thực tế'} wrapperStyle={{ fontSize: 12 }} />
        <Bar dataKey="keHoach" fill="hsl(213,65%,45%)" radius={[3,3,0,0]} />
        <Bar dataKey="thucTe" fill="hsl(145,55%,42%)" radius={[3,3,0,0]} />
      </BarChart>
    </ResponsiveContainer>
  );
}