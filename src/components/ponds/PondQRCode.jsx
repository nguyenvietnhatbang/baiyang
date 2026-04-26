import { useEffect, useRef, useState } from 'react';
import QRCode from 'qrcode';
import { Download } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { pondQrPayload } from '@/lib/fieldAuthHelpers';

export default function PondQRCode({ pond, size = 180 }) {
  const canvasRef = useRef(null);
  const [dataUrl, setDataUrl] = useState('');

  const qrValue = pondQrPayload(pond?.code);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || !qrValue) {
      setDataUrl('');
      return;
    }
    let cancelled = false;
    QRCode.toCanvas(canvas, qrValue, {
      width: size,
      margin: 2,
      color: { dark: '#1e3a5f', light: '#ffffff' },
      errorCorrectionLevel: 'M',
    })
      .then(() => {
        if (!cancelled && canvasRef.current) {
          setDataUrl(canvasRef.current.toDataURL('image/png'));
        }
      })
      .catch(() => {
        if (!cancelled) setDataUrl('');
      });
    return () => {
      cancelled = true;
    };
  }, [pond?.code, size, qrValue]);

  const handleDownload = () => {
    if (!dataUrl || !pond?.code) return;
    const a = document.createElement('a');
    a.href = dataUrl;
    a.download = `QR_${String(pond.code).replace(/[/\\]/g, '-')}.png`;
    a.click();
  };

  if (!qrValue) {
    return (
      <p className="text-sm text-muted-foreground text-center py-6">Chưa có mã ao để tạo QR.</p>
    );
  }

  return (
    <div className="flex flex-col items-center gap-3">
      <div className="border-2 border-border rounded-xl p-3 bg-white shadow-sm">
        <canvas ref={canvasRef} width={size} height={size} />
      </div>
      <div className="text-center">
        <p className="font-bold text-foreground text-sm">{pond.code}</p>
        <p className="text-xs text-muted-foreground">{pond.owner_name}</p>
        <p className="text-xs font-mono text-primary/60 mt-0.5">{qrValue}</p>
      </div>
      <Button
        size="sm"
        variant="outline"
        onClick={handleDownload}
        disabled={!dataUrl}
        className="flex items-center gap-2 w-full"
      >
        <Download className="w-3.5 h-3.5" />
        Tải QR về
      </Button>
    </div>
  );
}