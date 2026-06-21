import { useEffect, useRef, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { toast } from 'sonner';
import { base44 } from '@/api/base44Client';
import {
  parsePondCodeFromQr,
  pondCodeFromSearchParams,
  scanInputFromPondCode,
} from '@/lib/fieldAuthHelpers';
import { useAuth } from '@/lib/AuthContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ArrowLeft, ScanLine } from 'lucide-react';

export default function ScanPage() {
  const { user } = useAuth();
  const [searchParams] = useSearchParams();
  const [rawCode, setRawCode] = useState('');
  const [resolving, setResolving] = useState(false);
  const navigate = useNavigate();
  const autoResolvedRef = useRef(false);

  const resolveAndGo = async (raw) => {
    const code = parsePondCodeFromQr(raw);
    if (!code) {
      toast.error('Mã không hợp lệ');
      return;
    }
    setResolving(true);
    try {
      const p = await base44.entities.Pond.findByCodeFlattened(code);
      if (!p?.id) {
        toast.error('Không tìm thấy ao');
        return;
      }
      navigate(`/ponds/${encodeURIComponent(code)}?tab=log`);
    } catch {
      toast.error('Lỗi tra ao');
    } finally {
      setResolving(false);
    }
  };

  useEffect(() => {
    if (user?.fieldSession) {
      const q = searchParams.toString();
      navigate(q ? `/field/scan?${q}` : '/field/scan', { replace: true });
    }
  }, [user?.fieldSession, searchParams, navigate]);

  useEffect(() => {
    const code = pondCodeFromSearchParams(searchParams);
    if (!code) return;
    setRawCode(scanInputFromPondCode(code));
    if (autoResolvedRef.current) return;
    autoResolvedRef.current = true;
    void resolveAndGo(scanInputFromPondCode(code));
    // eslint-disable-next-line react-hooks/exhaustive-deps -- chỉ auto-mở khi mở link QR lần đầu
  }, [searchParams]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    const value = String(rawCode || '').trim();
    if (!value) {
      toast.error('Nhập hoặc quét mã trước khi tiếp tục');
      return;
    }
    await resolveAndGo(value);
  };

  if (user?.fieldSession) {
    return null;
  }

  return (
    <div className="p-3 sm:p-6 w-full max-w-3xl mx-auto min-h-[60dvh] text-base font-semibold leading-normal">
      <div className="flex items-center gap-2 mb-4">
        <Button type="button" variant="outline" className="h-11 text-base" onClick={() => navigate('/ponds')}>
          <ArrowLeft className="w-5 h-5 mr-1" />
          Về quản lý ao
        </Button>
      </div>

      <div className="rounded-2xl border border-border bg-card p-4 sm:p-5 shadow-sm">
        <h1 className="text-lg sm:text-xl font-extrabold text-foreground">Quét QR ao nuôi</h1>
        <p className="text-sm text-muted-foreground mt-1.5 font-semibold">
          Dùng máy quét hoặc dán nội dung QR vào ô nhập bên cạnh. Quét tem QR sẽ tự điền mã ao và mở form nhật ký.
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
            className="h-14 text-base"
          />
          <Button
            type="submit"
            className="h-14 px-6 text-base font-extrabold bg-teal-600 hover:bg-teal-700 text-white"
            disabled={resolving}
          >
            {resolving ? 'Đang mở…' : 'Vào form nhật ký'}
          </Button>
        </form>
      </div>

      <div className="mt-4 rounded-2xl border border-border bg-muted/30 p-4 sm:p-5">
        <p className="text-sm font-extrabold text-foreground">Hướng dẫn sử dụng</p>
        <ol className="mt-2 space-y-1.5 text-sm text-muted-foreground list-decimal list-inside font-semibold">
          <li>Bấm vào ô nhập, đặt con trỏ sẵn.</li>
          <li>Dùng máy quét QR quét tem dán trên ao (hoặc dán mã thủ công).</li>
          <li>Nhấn Enter hoặc bấm nút &quot;Vào form nhật ký&quot;.</li>
          <li>Hệ thống tự chuyển sang form điền nhật ký của ao tương ứng.</li>
        </ol>
      </div>
    </div>
  );
}
