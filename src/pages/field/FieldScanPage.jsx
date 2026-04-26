import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import { base44 } from '@/api/base44Client';
import QRScanner from '@/components/scanner/QRScanner';
import { parsePondCodeFromQr } from '@/lib/fieldAuthHelpers';
import { Button } from '@/components/ui/button';
import { ArrowLeft } from 'lucide-react';

export default function FieldScanPage() {
  const [open, setOpen] = useState(true);
  const navigate = useNavigate();

  const handleScan = async (raw) => {
    const code = parsePondCodeFromQr(raw);
    if (!code) {
      toast.error('Mã không hợp lệ');
      return;
    }
    try {
      const rows = await base44.entities.Pond.filter({ code }, '-updated_at', 1);
      const p = rows[0];
      if (!p) {
        toast.error('Không tìm thấy ao');
        return;
      }
      navigate(`/field/log?pond=${encodeURIComponent(p.id)}`, { replace: true });
    } catch {
      toast.error('Lỗi tra ao');
    }
  };

  return (
    <div className="min-h-[70dvh] flex flex-col">
      <div className="flex items-center gap-2 mb-3">
        <Button
          type="button"
          variant="outline"
          size="lg"
          className="h-12 text-base border-stone-300 text-stone-900 font-medium"
          onClick={() => navigate('/field', { replace: true })}
        >
          <ArrowLeft className="w-5 h-5 mr-1" />
          Về trang chủ
        </Button>
      </div>
      <p className="text-base text-stone-800 mb-4 text-center leading-relaxed px-1 max-w-lg mx-auto">
        Hướng camera vào mã dán trên ao <span className="font-semibold text-stone-950">(dạng POND:mã ao)</span>
      </p>
      {open ? (
        <QRScanner
          onScan={(t) => {
            setOpen(false);
            void handleScan(t);
          }}
          onClose={() => {
            setOpen(false);
            navigate('/field', { replace: true });
          }}
        />
      ) : (
        <Button className="mt-4 h-14 text-lg font-bold bg-teal-600 hover:bg-teal-700 text-white" onClick={() => setOpen(true)}>
          Mở lại camera
        </Button>
      )}
    </div>
  );
}
