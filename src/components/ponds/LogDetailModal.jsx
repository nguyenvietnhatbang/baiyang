import { X, Droplets, Fish, Pill, ClipboardList } from 'lucide-react';

const ENV_RANGES = {
  ph: { min: 6.5, max: 8.5 },
  temperature: { min: 25, max: 32 },
  do: { min: 5, max: 12 },
  nh3: { min: 0, max: 0.3 },
  no2: { min: 0, max: 0.05 },
  h2s: { min: 0, max: 0.02 },
};

function isAlert(key, value) {
  if (!value) return false;
  const r = ENV_RANGES[key];
  if (!r) return false;
  return Number(value) < r.min || Number(value) > r.max;
}

function Field({ label, value, alert }) {
  if (value === null || value === undefined || value === '') return null;
  return (
    <div className="bg-muted/50 rounded-lg p-2.5">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className={`font-semibold text-sm mt-0.5 ${alert ? 'text-red-500' : 'text-foreground'}`}>{value}{alert ? ' ⚠️' : ''}</p>
    </div>
  );
}

export default function LogDetailModal({ log, onClose }) {
  if (!log) return null;
  return (
    <div className="fixed inset-0 z-[70] flex items-center justify-center bg-black/50" onClick={onClose}>
      <div
        className="bg-card rounded-2xl shadow-2xl w-full max-w-lg mx-4 max-h-[90vh] overflow-y-auto"
        onClick={e => e.stopPropagation()}
      >
        <div className="flex items-center justify-between px-5 py-4 border-b border-border sticky top-0 bg-card z-10">
          <div>
            <p className="font-bold text-foreground">{log.pond_code} — {log.log_date}</p>
            <p className="text-xs text-muted-foreground mt-0.5">Chi tiết nhật ký</p>
          </div>
          <button onClick={onClose} className="text-muted-foreground hover:text-foreground p-1">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-5 space-y-5">
          {/* Môi trường nước */}
          <div>
            <p className="text-xs font-bold text-primary uppercase tracking-widest mb-2 flex items-center gap-1.5">
              <Droplets className="w-3.5 h-3.5" /> Chất lượng nước
            </p>
            <div className="grid grid-cols-3 gap-2">
              <Field label="pH" value={log.ph} alert={isAlert('ph', log.ph)} />
              <Field label="Nhiệt độ (°C)" value={log.temperature} alert={isAlert('temperature', log.temperature)} />
              <Field label="DO (mg/L)" value={log.do} alert={isAlert('do', log.do)} />
              <Field label="NH3 (mg/L)" value={log.nh3} alert={isAlert('nh3', log.nh3)} />
              <Field label="NO2 (mg/L)" value={log.no2} alert={isAlert('no2', log.no2)} />
              <Field label="H2S (mg/L)" value={log.h2s} alert={isAlert('h2s', log.h2s)} />
            </div>
            {log.water_color && (
              <p className="text-xs text-muted-foreground mt-2">Màu nước: <span className="font-medium text-foreground">{log.water_color}</span></p>
            )}
          </div>

          {/* Thức ăn & Cá */}
          <div>
            <p className="text-xs font-bold text-blue-600 uppercase tracking-widest mb-2 flex items-center gap-1.5">
              <Fish className="w-3.5 h-3.5" /> Cho ăn & Sinh trưởng
            </p>
            <div className="grid grid-cols-3 gap-2">
              <Field label="Mã thức ăn" value={log.feed_code} />
              <Field label="Lượng ăn (kg)" value={log.feed_amount} />
              <Field label="TL TB (g)" value={log.avg_weight} />
            </div>
            {log.dead_fish > 0 && (
              <div className="mt-2 bg-red-50 border border-red-200 rounded-lg p-2.5 flex items-center gap-2">
                <span className="text-red-500 font-bold text-sm">-{log.dead_fish} con</span>
                <span className="text-xs text-red-400">cá hao hụt</span>
              </div>
            )}
          </div>

          {/* Thuốc */}
          {log.medicine_used && (
            <div>
              <p className="text-xs font-bold text-orange-600 uppercase tracking-widest mb-2 flex items-center gap-1.5">
                <Pill className="w-3.5 h-3.5" /> Thuốc & Xử lý
              </p>
              <div className="bg-orange-50 border border-orange-200 rounded-lg p-3 space-y-1 text-sm">
                <p><span className="text-muted-foreground text-xs">Thuốc:</span> <span className="font-semibold">{log.medicine_used}</span></p>
                {log.medicine_dosage && <p><span className="text-muted-foreground text-xs">Liều:</span> {log.medicine_dosage}</p>}
                {log.withdrawal_days && <p><span className="text-muted-foreground text-xs">Ngưng thuốc:</span> <span className="font-semibold text-orange-600">{log.withdrawal_days} ngày</span></p>}
              </div>
              {log.disease_notes && <p className="text-xs text-muted-foreground mt-2 bg-muted/50 rounded p-2">{log.disease_notes}</p>}
            </div>
          )}

          {/* Ghi chú */}
          {log.notes && (
            <div>
              <p className="text-xs font-bold text-muted-foreground uppercase tracking-widest mb-1 flex items-center gap-1.5">
                <ClipboardList className="w-3.5 h-3.5" /> Ghi chú
              </p>
              <p className="text-sm text-foreground bg-muted/30 rounded p-2">{log.notes}</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}