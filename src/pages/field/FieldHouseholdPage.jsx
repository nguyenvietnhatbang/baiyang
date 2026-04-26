import { useEffect, useState } from 'react';
import { base44 } from '@/api/base44Client';
import { useAuth } from '@/lib/AuthContext';
import { toast } from 'sonner';

export default function FieldHouseholdPage() {
  const { user } = useAuth();
  const [households, setHouseholds] = useState([]);
  const [pondsByHousehold, setPondsByHousehold] = useState({});
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      try {
        if (user?.role === 'household_owner' && user.household_id) {
          const hh = await base44.entities.Household.filter({ id: user.household_id }, '-updated_at', 1);
          if (!cancelled) {
            setHouseholds(hh);
            if (hh[0]) {
              const ponds = await base44.entities.Pond.filter({ household_id: hh[0].id }, 'code', 200);
              if (!cancelled) setPondsByHousehold({ [hh[0].id]: ponds });
            }
          }
          return;
        }

        if (user?.role === 'agency' && user.agency_id) {
          const hh = await base44.entities.Household.filter({ agency_id: user.agency_id }, 'name', 500);
          if (cancelled) return;
          setHouseholds(hh);
          const map = {};
          await Promise.all(
            hh.map(async (h) => {
              const ponds = await base44.entities.Pond.filter({ household_id: h.id }, 'code', 200);
              map[h.id] = ponds;
            })
          );
          if (!cancelled) setPondsByHousehold(map);
          return;
        }

        if (!cancelled) setHouseholds([]);
      } catch {
        if (!cancelled) toast.error('Không tải được dữ liệu hộ');
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    void load();
    return () => {
      cancelled = true;
    };
  }, [user?.role, user?.household_id, user?.agency_id]);

  if (loading) {
    return <p className="text-center text-stone-800 py-14 text-base font-medium">Đang tải…</p>;
  }

  if (households.length === 0) {
    return (
      <p className="text-center text-stone-800 text-base py-10 px-3 rounded-2xl border-2 border-dashed border-stone-300 bg-white leading-relaxed shadow-sm">
        Chưa có thông tin hộ trong phạm vi tài khoản. Liên hệ đại lý nếu cần.
      </p>
    );
  }

  return (
    <div className="space-y-5">
      <h1 className="text-xl font-bold text-stone-900">Thông tin hộ nuôi</h1>
      <p className="text-sm text-stone-700 -mt-2">Chỉ xem nhanh — chi tiết đầy đủ do đại lý / quản trị quản lý.</p>
      {households.map((h) => {
        const ponds = pondsByHousehold[h.id] || [];
        return (
          <div key={h.id} className="rounded-2xl border border-stone-200 bg-white p-4 md:p-5 shadow-sm space-y-3">
            <p className="font-bold text-stone-950 text-lg leading-tight">{h.name}</p>
            <p className="text-sm text-stone-700">
              Mã phân đoạn: <span className="font-semibold text-stone-900">{h.household_segment}</span>
            </p>
            <p className="text-sm text-stone-700">
              Vùng: <span className="font-semibold text-stone-900">{h.region_code}</span>
            </p>
            {h.address ? <p className="text-sm text-stone-800 leading-snug">{h.address}</p> : null}
            <div className="pt-3 border-t border-stone-200">
              <p className="text-xs font-bold text-stone-600 uppercase tracking-wide mb-2">Các ao ({ponds.length})</p>
              <ul className="flex flex-wrap gap-2">
                {ponds.length === 0 ? (
                  <li className="text-sm text-stone-700">—</li>
                ) : (
                  ponds.map((p) => (
                    <li
                      key={p.id}
                      className="text-sm px-3 py-1.5 rounded-xl bg-teal-100 text-teal-950 font-mono font-semibold border border-teal-200"
                    >
                      {p.code}
                    </li>
                  ))
                )}
              </ul>
            </div>
          </div>
        );
      })}
    </div>
  );
}
