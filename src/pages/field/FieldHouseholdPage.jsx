import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { base44 } from '@/api/base44Client';
import { useAuth } from '@/lib/AuthContext';
import { toast } from 'sonner';
import PondStatusBadge from '@/components/ponds/PondStatusBadge';
import { ChevronRight, MapPin } from 'lucide-react';

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
      <div>
        <h1 className="text-xl font-bold text-stone-900">Hộ nuôi &amp; ao</h1>
        <p className="text-sm text-stone-600 mt-1">
          Xem nhanh thông tin hộ; bấm vào từng ao để mở màn hình nhật ký (giống quản lý về dữ liệu cơ bản).
        </p>
      </div>

      {households.map((h) => {
        const ponds = pondsByHousehold[h.id] || [];
        return (
          <div
            key={h.id}
            className="rounded-2xl border border-stone-200 bg-white p-4 md:p-5 shadow-sm space-y-4"
          >
            <div className="flex flex-wrap items-start justify-between gap-2">
              <div>
                <p className="font-bold text-stone-950 text-lg leading-tight">{h.name}</p>
                <p className="text-sm text-stone-600 mt-1">
                  Mã phân đoạn: <span className="font-semibold text-stone-900">{h.household_segment}</span>
                  {' · '}
                  Vùng: <span className="font-semibold text-stone-900">{h.region_code}</span>
                </p>
              </div>
              {typeof h.active === 'boolean' && (
                <span
                  className={`text-xs font-bold px-2.5 py-1 rounded-full ${
                    h.active ? 'bg-green-100 text-green-800' : 'bg-stone-200 text-stone-600'
                  }`}
                >
                  {h.active ? 'Đang hoạt động' : 'Ngưng'}
                </span>
              )}
            </div>

            {h.address ? (
              <p className="flex gap-2 text-sm text-stone-800 leading-snug">
                <MapPin className="w-4 h-4 shrink-0 text-stone-500 mt-0.5" />
                {h.address}
              </p>
            ) : null}

            <div className="pt-3 border-t border-stone-100">
              <p className="text-xs font-bold text-stone-500 uppercase tracking-wide mb-3">
                Các ao ({ponds.length}) — chọn để nhập nhật ký
              </p>
              {ponds.length === 0 ? (
                <p className="text-sm text-stone-600">Chưa có ao gắn với hộ này.</p>
              ) : (
                <ul className="space-y-2">
                  {ponds.map((p) => (
                    <li key={p.id}>
                      <Link
                        to={`/field/log?pond=${encodeURIComponent(p.id)}`}
                        className="flex items-center justify-between gap-3 rounded-xl border border-stone-200 bg-stone-50/80 px-3 py-3 hover:bg-teal-50 hover:border-teal-200 transition-colors"
                      >
                        <div className="min-w-0">
                          <p className="font-mono font-bold text-stone-900">{p.code}</p>
                          <div className="flex flex-wrap items-center gap-2 mt-1">
                            <PondStatusBadge status={p.status} />
                            {p.area != null && (
                              <span className="text-xs text-stone-600">{p.area} m²</span>
                            )}
                            {p.current_fish != null && (
                              <span className="text-xs text-stone-600">
                                {p.current_fish.toLocaleString()} con
                              </span>
                            )}
                          </div>
                        </div>
                        <ChevronRight className="w-5 h-5 text-stone-400 shrink-0" />
                      </Link>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}
