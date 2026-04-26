import { useEffect, useRef, useState } from 'react';
import QRCode from 'qrcode';
import { Download } from 'lucide-react';
import { Button } from '@/components/ui/button';

export default function PondQRCode({ pond, size = 180 }) {
  const canvasRef = useRef(null);
  const [dataUrl, setDataUrl] = useState('');

  const qrValue = `POND:${pond.code}`;

  useEffect(() => {
    if (!canvasRef.current) return;
    QRCode.toCanvas(canvasRef.current, qrValue, {
      width: size,
      margin: 2,
      color: { dark: '#1e3a5f', light: '#ffffff' },
    }).then(() => {
      setDataUrl(canvasRef.current.toDataURL('image/png'));
    });
  }, [pond.code, size]);

  const handleDownload = () => {
    if (!dataUrl) return;
    const a = document.createElement('a');
    a.href = dataUrl;
    a.download = `QR_${pond.code}.png`;
    a.click();
  };

  return (
    <div className="flex flex-col items-center gap-3">
      <div className="border-2 border-border rounded-xl p-3 bg-white shadow-sm">
        <canvas ref={canvasRef} />
      </div>
      <div className="text-center">
        <p className="font-bold text-foreground text-sm">{pond.code}</p>
        <p className="text-xs text-muted-foreground">{pond.owner_name}</p>
        <p className="text-xs font-mono text-primary/60 mt-0.5">{qrValue}</p>
      </div>
      <Button size="sm" variant="outline" onClick={handleDownload} className="flex items-center gap-2 w-full">
        <Download className="w-3.5 h-3.5" />
        Tải QR về
      </Button>
    </div>
  );
}