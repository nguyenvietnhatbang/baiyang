import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import { base44 } from '@/api/base44Client';
import { parsePondCodeFromQr } from '@/lib/fieldAuthHelpers';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ArrowLeft, ScanLine } from 'lucide-react';

export default function FieldScanPage() {
  const [rawCode, setRawCode] = useState('');
  const [resolving, setResolving] = useState(false);
  const navigate = useNavigate();

  const handleScan = async (raw) => {
    const code = parsePondCodeFromQr(raw);
    if (!code) {
      toast.error('Mã không hợp lệ');
      return;
    }
    try {
      let p = await base44.entities.Pond.findByCodeFlattened(code);
      if (!p) {
        toast.error('Không tìm thấy ao');
        return;
      }
      navigate(`/field/log?pond=${encodeURIComponent(p.id)}`);
    } catch {
      toast.error('Lỗi tra ao');
    } finally {
      setResolving(false);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    const value = String(rawCode || '').trim();
    if (!value) {
      toast.error('Nhập hoặc quét mã trước khi tiếp tục');
      return;
    }
    setResolving(true);
    await handleScan(value);
  };

  return (
    <div className="min-h-[70dvh] max-w-2xl mx-auto">
      <div className="flex items-center gap-2 mb-4">
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

      <div className="rounded-2xl border border-stone-200 bg-white p-4 sm:p-5 shadow-sm">
        <h1 className="text-lg sm:text-xl font-bold text-stone-900">Quét QR ao nuôi</h1>
        <p className="text-sm text-stone-600 mt-1.5">
          Dùng máy quét hoặc dán nội dung QR vào ô nhập bên cạnh.
        </p>

        <form onSubmit={handleSubmit} className="mt-4 flex flex-col sm:flex-row gap-3 sm:items-center">
          <div className="h-14 w-full sm:w-16 rounded-xl border border-teal-200 bg-teal-50 text-teal-700 flex items-center justify-center shrink-0">
            <ScanLine className="w-7 h-7" strokeWidth={2.25} />
          </div>
          <Input
            autoFocus
            value={rawCode}
            onChange={(e) => setRawCode(e.target.value)}
            placeholder="Ví dụ: POND:17-01-001-01 hoặc 17-01-001-01"
            className="h-14 text-base border-stone-300"
          />
          <Button type="submit" className="h-14 px-6 text-base font-bold bg-teal-600 hover:bg-teal-700" disabled={resolving}>
            {resolving ? 'Đang mở…' : 'Vào form nhật ký'}
          </Button>
        </form>
      </div>

      <div className="mt-4 rounded-2xl border border-stone-200 bg-stone-50 p-4 sm:p-5">
        <p className="text-sm font-bold text-stone-900">Hướng dẫn sử dụng</p>
        <ol className="mt-2 space-y-1.5 text-sm text-stone-700 list-decimal list-inside">
          <li>Bấm vào ô nhập, đặt con trỏ sẵn.</li>
          <li>Dùng máy quét QR quét tem dán trên ao (hoặc dán mã thủ công).</li>
          <li>Nhấn Enter hoặc bấm nút "Vào form nhật ký".</li>
          <li>Hệ thống tự chuyển sang form điền nhật ký của ao tương ứng.</li>
        </ol>
      </div>
    </div>
  );
}
