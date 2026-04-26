import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { base44 } from '@/api/base44Client';
import { Camera, ChevronRight } from 'lucide-react';
import QRScanner from '@/components/scanner/QRScanner';
import { parsePondCodeFromQr } from '@/lib/fieldAuthHelpers';
import { useNavigate } from 'react-router-dom';
import { toast } from 'sonner';

export default function FieldHome() {
  const [ponds, setPonds] = useState([]);
  const [loading, setLoading] = useState(true);
  const [scannerOpen, setScannerOpen] = useState(false);
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

  const resolveAndGo = async (rawQr) => {
    const code = parsePondCodeFromQr(rawQr);
    if (!code) {
      toast.error('Mã QR không hợp lệ');
      return;
    }
    const found = ponds.find((p) => p.code === code);
    if (found) {
      navigate(`/field/log?pond=${encodeURIComponent(found.id)}`);
      return;
    }
    try {
      const rows = await base44.entities.Pond.filter({ code }, '-updated_at', 1);
      const p = rows[0];
      if (p) navigate(`/field/log?pond=${encodeURIComponent(p.id)}`);
      else toast.error('Không tìm thấy ao trong phạm vi của bạn');
    } catch {
      toast.error('Không tra được ao');
    }
  };

  return (
    <div className="space-y-6">
      <button
        type="button"
        onClick={() => setScannerOpen(true)}
        className="w-full rounded-2xl bg-teal-600 hover:bg-teal-700 text-white p-5 sm:p-6 shadow-lg shadow-teal-600/20 active:scale-[0.99] transition-all text-left"
      >
        <div className="flex items-center gap-4">
          <div className="w-14 h-14 sm:w-16 sm:h-16 rounded-2xl bg-white/20 flex items-center justify-center shrink-0">
            <Camera className="w-8 h-8 sm:w-9 sm:h-9" strokeWidth={2} />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-lg sm:text-xl font-bold">Quét mã QR ao</p>
            <p className="text-sm text-white font-medium mt-0.5 drop-shadow-sm">Bấm vào đây — mở camera — ghi nhật ký nhanh</p>
          </div>
          <ChevronRight className="w-6 h-6 shrink-0 opacity-90" />
        </div>
      </button>

      <div>
        <h2 className="text-sm font-bold text-stone-800 uppercase tracking-wide mb-3">Danh sách ao</h2>
        {loading ? (
          <p className="text-stone-700 text-base py-10 text-center rounded-2xl bg-white border border-stone-200 shadow-sm">
            Đang tải…
          </p>
        ) : ponds.length === 0 ? (
          <p className="text-stone-800 text-base py-8 text-center rounded-2xl border-2 border-dashed border-stone-300 bg-white px-4 shadow-sm">
            Chưa có ao trong phạm vi. Liên hệ đại lý nếu cần hỗ trợ.
          </p>
        ) : (
          <ul className="grid gap-3 sm:grid-cols-1 md:grid-cols-2">
            {ponds.map((p) => (
              <li key={p.id}>
                <Link
                  to={`/field/log?pond=${encodeURIComponent(p.id)}`}
                  className="flex items-center justify-between rounded-2xl border border-stone-200 bg-white px-4 py-4 shadow-sm hover:border-teal-200 hover:shadow-md transition-shadow"
                >
                  <div className="min-w-0">
                    <p className="font-bold text-stone-950 text-lg leading-tight">{p.code}</p>
                    <p className="text-sm text-stone-700 mt-0.5">
                      {p.owner_name || '—'} ·{' '}
                      <span className="font-semibold text-teal-900">{p.status}</span>
                    </p>
                  </div>
                  <ChevronRight className="w-6 h-6 text-stone-600 shrink-0" />
                </Link>
              </li>
            ))}
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
