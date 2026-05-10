import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { differenceInDays, parseISO } from 'date-fns';
import { base44 } from '@/api/base44Client';
import { Camera, ChevronRight, Search } from 'lucide-react';
import QRScanner from '@/components/scanner/QRScanner';
import { parsePondCodeFromQr, pondCodesEqual } from '@/lib/fieldAuthHelpers';
import { useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import { useAuth } from '@/lib/AuthContext';
import PondStatusBadge from '@/components/ponds/PondStatusBadge';
import { plannedHarvestDateForDisplay } from '@/lib/planReportHelpers';
import { Input } from '@/components/ui/input';

/** Hero: gradient teal, gọn để ưu tiên danh sách ao. */
const FIELD_HOME_HERO_STYLE = {
  background: 'linear-gradient(135deg, #0f766e 0%, #115e59 55%, #134e4a 100%)',
  color: '#ffffff',
};

export default function FieldHome() {
  const { harvestAlertDays } = useAuth();
  const [ponds, setPonds] = useState([]);
  const [loading, setLoading] = useState(true);
  const [scannerOpen, setScannerOpen] = useState(false);
  const [query, setQuery] = useState('');
  const navigate = useNavigate();

  useEffect(() => {
    let cancelled = false;
    base44.entities.Pond.listWithHouseholds('-updated_at', 500)
      .then((rows) => {
        if (!cancelled) setPonds(rows || []);
      })
      .catch(() => {
        if (!cancelled) toast.error('Không tải được danh sách ao');
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const filteredPonds = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return ponds;
    return ponds.filter(
      (p) =>
        (p.code && p.code.toLowerCase().includes(q)) ||
        (p.owner_name && p.owner_name.toLowerCase().includes(q)) ||
        (p.agency_code && String(p.agency_code).toLowerCase().includes(q)) ||
        (p.location && p.location.toLowerCase().includes(q))
    );
  }, [ponds, query]);

  const resolveAndGo = async (rawQr) => {
    const code = parsePondCodeFromQr(rawQr);
    if (!code) {
      toast.error('Mã QR không hợp lệ');
      return;
    }
    const found = ponds.find((p) => pondCodesEqual(p.code, code));
    if (found) {
      navigate(`/field/log?pond=${encodeURIComponent(found.id)}`);
      return;
    }
    try {
      const p = await base44.entities.Pond.findByCodeFlattened(code);
      if (p) navigate(`/field/log?pond=${encodeURIComponent(p.id)}`);
      else toast.error('Không tìm thấy ao trong phạm vi của bạn');
    } catch {
      toast.error('Không tra được ao');
    }
  };

  const alertDays = harvestAlertDays ?? 7;

  return (
    <div className="space-y-5 md:space-y-6">
      <div
        className="rounded-2xl p-4 sm:p-5 shadow-md border border-teal-950/30 overflow-hidden bg-teal-900 text-white"
        style={FIELD_HOME_HERO_STYLE}
      >
        <div className="flex flex-col lg:flex-row lg:items-center lg:gap-6">
          <div className="min-w-0 flex-1">
            <p className="text-[10px] sm:text-[11px] font-extrabold uppercase tracking-[0.12em] text-white/80">
              Làm việc nhanh
            </p>
            <h1 className="text-lg sm:text-xl font-bold mt-1.5 leading-snug text-white">
              Chọn ao hoặc quét QR để ghi nhật ký
            </h1>
            <p className="text-xs sm:text-sm text-white/90 mt-1.5 leading-relaxed max-w-xl">
              Mã trên ao thường có dạng <span className="font-mono font-semibold text-emerald-200">POND:…</span>
            </p>
          </div>
          <button
            type="button"
            onClick={() => setScannerOpen(true)}
            className="mt-4 lg:mt-0 w-full lg:w-auto lg:shrink-0 rounded-xl bg-white/95 hover:bg-white text-teal-900 font-bold text-sm sm:text-base py-3 px-4 flex items-center justify-center gap-3 shadow-sm border border-white/50 transition-colors active:scale-[0.99] min-h-[3rem] lg:min-w-[16rem]"
          >
            <span className="w-10 h-10 rounded-lg bg-teal-700 text-white flex items-center justify-center shrink-0">
              <Camera className="w-5 h-5" strokeWidth={2.25} />
            </span>
            <span className="text-left leading-tight">
              Quét QR ao
              <span className="block text-[11px] font-medium text-teal-800/75 mt-0.5">Cho phép camera khi trình duyệt hỏi</span>
            </span>
          </button>
        </div>
      </div>

      <div>
        <div className="flex flex-col gap-3 mb-4">
          <div className="flex flex-col sm:flex-row sm:items-center sm:gap-4">
            <div className="shrink-0">
              <h2 className="text-lg font-bold text-stone-900 tracking-tight">Danh sách ao</h2>
              <p className="text-sm text-stone-500 mt-0.5 tabular-nums">
                {loading ? 'Đang tải…' : `${filteredPonds.length} / ${ponds.length} ao`}
              </p>
            </div>
            <div className="relative flex-1 min-w-0 w-full">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-stone-400 pointer-events-none" />
              <Input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Tìm theo mã ao, chủ, đại lý, địa điểm…"
                className="pl-9 h-10 border-stone-200/90 bg-white shadow-sm"
              />
            </div>
          </div>
        </div>

        {loading ? (
          <p className="text-stone-700 text-base py-14 text-center rounded-2xl bg-white border border-stone-200 shadow-sm">
            Đang tải…
          </p>
        ) : ponds.length === 0 ? (
          <p className="text-stone-800 text-base py-10 text-center rounded-2xl border-2 border-dashed border-stone-300 bg-white px-4 shadow-sm leading-relaxed">
            Chưa có ao trong phạm vi. Liên hệ đại lý nếu cần hỗ trợ.
          </p>
        ) : filteredPonds.length === 0 ? (
          <p className="text-stone-700 text-sm py-8 text-center rounded-2xl bg-white border border-stone-200">
            Không có ao khớp tìm kiếm. Thử bỏ bớt từ khóa.
          </p>
        ) : (
          <ul className="grid gap-3 sm:grid-cols-1 xl:grid-cols-2">
            {filteredPonds.map((p) => {
              const today = new Date();
              const diff = p.expected_harvest_date ? differenceInDays(parseISO(p.expected_harvest_date), today) : null;
              const isUrgent = diff !== null && diff <= alertDays;
              const isOverdue = diff !== null && diff < 0;
              const isWithdrawal =
                p.withdrawal_end_date && differenceInDays(parseISO(p.withdrawal_end_date), today) >= 0;

              return (
                <li key={p.id}>
                  <Link
                    to={`/field/log?pond=${encodeURIComponent(p.id)}`}
                    className={`group flex flex-col rounded-xl border bg-white px-4 py-3.5 shadow-sm hover:shadow-md hover:border-teal-300/60 transition-all active:scale-[0.995] ${
                      isOverdue ? 'border-red-200/90 bg-red-50/40' : isUrgent ? 'border-amber-200/80 bg-amber-50/25' : 'border-stone-200/90'
                    }`}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2 flex-wrap">
                          <p className="font-bold text-stone-900 text-base leading-tight font-mono tracking-tight">{p.code}</p>
                          {p.fcr != null && (
                            <span
                              className={`text-[10px] font-bold px-1.5 py-0.5 rounded-md tabular-nums ${
                                p.fcr <= 1.3
                                  ? 'bg-emerald-100 text-emerald-800'
                                  : p.fcr <= 1.6
                                    ? 'bg-amber-100 text-amber-900'
                                    : 'bg-red-100 text-red-800'
                              }`}
                            >
                              FCR {p.fcr}
                            </span>
                          )}
                        </div>
                        <p className="text-sm text-stone-600 mt-1 truncate">{p.owner_name || '—'}</p>
                      </div>
                      <div className="flex items-start gap-1.5 shrink-0">
                        <div className="flex flex-col items-end gap-1">
                          <PondStatusBadge status={p.status} />
                          {isUrgent && p.status === 'CC' && (
                            <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-md bg-red-100 text-red-700">THU</span>
                          )}
                          {isWithdrawal && (
                            <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-md bg-orange-100 text-orange-800">
                              THUỐC
                            </span>
                          )}
                        </div>
                        <ChevronRight className="w-5 h-5 text-stone-300 group-hover:text-teal-600 transition-colors hidden sm:block mt-0.5" />
                      </div>
                    </div>

                    <div className="mt-3 grid grid-cols-3 gap-2">
                      <div className="rounded-lg bg-stone-50/90 border border-stone-100/80 py-2 px-2 text-left">
                        <p className="text-[10px] uppercase tracking-wide text-stone-500 font-semibold">Diện tích</p>
                        <p className="font-semibold text-stone-900 text-sm mt-0.5 tabular-nums">{p.area != null ? `${p.area} m²` : '—'}</p>
                      </div>
                      <div className="rounded-lg bg-stone-50/90 border border-stone-100/80 py-2 px-2 text-left">
                        <p className="text-[10px] uppercase tracking-wide text-stone-500 font-semibold">Số cá</p>
                        <p className="font-semibold text-stone-900 text-sm mt-0.5 tabular-nums">
                          {p.current_fish != null ? p.current_fish.toLocaleString() : '—'}
                        </p>
                      </div>
                      <div className="rounded-lg bg-stone-50/90 border border-stone-100/80 py-2 px-2 text-left">
                        <p className="text-[10px] uppercase tracking-wide text-stone-500 font-semibold">Dự kiến</p>
                        <p className="font-semibold text-stone-900 text-sm mt-0.5 tabular-nums leading-tight">
                          {p.expected_yield != null ? `${p.expected_yield.toLocaleString()} kg` : '—'}
                        </p>
                      </div>
                    </div>

                    <div className="mt-2.5 flex flex-wrap items-baseline gap-x-4 gap-y-1 text-xs text-stone-600">
                      <span>
                        Đại lý{' '}
                        <span className="font-semibold text-stone-800">{p.agency_code || '—'}</span>
                      </span>
                      {dk && (
                        <span className={isOverdue || isUrgent ? 'text-red-600 font-semibold' : 'text-stone-600'}>
                          Thu <span className="font-medium text-stone-800">{dk}</span>
                          {isOverdue && ' · QH'}
                        </span>
                      )}
                    </div>
                    {p.location && (
                      <p className="mt-2 text-xs text-stone-500 line-clamp-2 leading-snug border-t border-stone-100 pt-2">{p.location}</p>
                    )}
                  </Link>
                </li>
              );
            })}
          </ul>
        )}
      </div>

      {scannerOpen ? (
        <QRScanner
          onScan={(text) => {
            setScannerOpen(false);
            void resolveAndGo(text);
          }}
          onClose={() => setScannerOpen(false)}
        />
      ) : null}
    </div>
  );
}
