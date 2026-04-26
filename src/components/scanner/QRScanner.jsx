import { useEffect, useRef, useState } from 'react';
import { Html5Qrcode } from 'html5-qrcode';
import { X, CameraOff } from 'lucide-react';
import { Button } from '@/components/ui/button';

export default function QRScanner({ onScan, onClose }) {
  const scannerRef = useRef(null);
  const [error, setError] = useState('');
  const scannerDivId = 'html5-qrcode-scanner';

  useEffect(() => {
    const html5Qrcode = new Html5Qrcode(scannerDivId);
    scannerRef.current = html5Qrcode;

    html5Qrcode.start(
      { facingMode: 'environment' },
      { fps: 10, qrbox: { width: 220, height: 220 } },
      (decodedText) => {
        onScan(decodedText);
        html5Qrcode.stop().catch(() => {});
      },
      () => {}
    ).catch(() => setError('Không thể truy cập camera. Vui lòng cho phép quyền camera.'));

    return () => {
      if (scannerRef.current) {
        scannerRef.current.stop().catch(() => {});
      }
    };
  }, []);

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/70">
      <div className="bg-card rounded-2xl shadow-2xl w-full max-w-sm mx-4 overflow-hidden">
        <div className="flex items-center justify-between px-4 py-3 border-b border-border bg-primary text-primary-foreground">
          <p className="font-semibold text-sm">📷 Quét mã QR ao nuôi</p>
          <button type="button" onClick={onClose} className="text-primary-foreground/80 hover:text-primary-foreground rounded-md p-0.5">
            <X className="w-5 h-5" />
          </button>
        </div>
        <div className="p-4">
          {error ? (
            <div className="flex flex-col items-center gap-3 py-8 text-center">
              <CameraOff className="w-10 h-10 text-muted-foreground" />
              <p className="text-sm text-red-600">{error}</p>
              <Button variant="outline" size="sm" onClick={onClose}>Đóng</Button>
            </div>
          ) : (
            <>
              <div id={scannerDivId} className="rounded-lg overflow-hidden" />
              <p className="text-xs text-muted-foreground text-center mt-3">
                Hướng camera vào mã QR dán trên ao
              </p>
            </>
          )}
        </div>
      </div>
    </div>
  );
}