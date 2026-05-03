import { useEffect, useRef, useState, useId } from 'react';
import { Html5Qrcode } from 'html5-qrcode';
import { X, CameraOff } from 'lucide-react';
import { Button } from '@/components/ui/button';

/** Chọn camera: điện thoại ưu tiên camera sau; PC thường chỉ có webcam → lấy thiết bị đầu danh sách. */
function pickCameraDeviceId(devices) {
  if (!devices?.length) return null;
  const back = devices.find((d) =>
    /back|rear|mặt sau|environment|wide|đằng sau|world facing/i.test(d.label || '')
  );
  if (back) return back.id;
  return devices[0].id;
}

/** BarcodeDetector trên một số trình duyệt desktop (Chrome/Win) hay “câm” — chỉ bật trên mobile. */
function barCodeDetectorSupportedOnThisDevice() {
  return /Android|iPhone|iPad|iPod/i.test(typeof navigator !== 'undefined' ? navigator.userAgent : '');
}

/**
 * Đóng camera hoàn toàn trước khi gọi onScan — tránh race unmount + điều hướng trên mobile (màn trắng, Back hỏng).
 */
export default function QRScanner({ onScan, onClose }) {
  const scannerRef = useRef(null);
  const handledRef = useRef(false);
  const onScanRef = useRef(onScan);
  onScanRef.current = onScan;
  const [error, setError] = useState('');
  const reactId = useId();
  const scannerDivId = `html5-qrcode-${reactId.replace(/:/g, '')}`;

  useEffect(() => {
    let cancelled = false;
    handledRef.current = false;
    const html5Qrcode = new Html5Qrcode(scannerDivId, {
      verbose: false,
      experimentalFeatures: {
        useBarCodeDetectorIfSupported: barCodeDetectorSupportedOnThisDevice(),
      },
    });
    scannerRef.current = html5Qrcode;

    const releaseDomAfterCamera = async () => {
      await new Promise((r) => setTimeout(r, 120));
      try {
        document.body.style.overflow = '';
        document.body.style.position = '';
        document.documentElement.style.overflow = '';
      } catch {
        /* ignore */
      }
    };

    const onSuccess = (decodedText) => {
      if (cancelled || handledRef.current) return;
      handledRef.current = true;
      void (async () => {
        try {
          await html5Qrcode.stop();
        } catch {
          /* đã dừng hoặc thiết bị báo lỗi */
        }
        try {
          html5Qrcode.clear();
        } catch {
          /* ignore */
        }
        scannerRef.current = null;
        if (cancelled) return;
        await releaseDomAfterCamera();
        if (cancelled) return;
        onScanRef.current(decodedText);
      })();
    };

    const scanConfig = { fps: 10, qrbox: { width: 250, height: 250 } };

    void (async () => {
      try {
        const devices = await Html5Qrcode.getCameras();
        if (cancelled) return;

        if (devices?.length) {
          const cameraId = pickCameraDeviceId(devices);
          if (cameraId) {
            try {
              await html5Qrcode.start(cameraId, scanConfig, onSuccess, () => {});
              return;
            } catch {
              /* deviceId đôi khi lỗi sau cập nhật driver — thử constraint bên dưới */
            }
          }
        }

        try {
          await html5Qrcode.start({ facingMode: 'user' }, scanConfig, onSuccess, () => {});
          return;
        } catch {
          /* thử camera sau (tablet/laptop hiếm) */
        }
        try {
          await html5Qrcode.start({ facingMode: 'environment' }, scanConfig, onSuccess, () => {});
        } catch {
          if (!cancelled) {
            setError('Không thể mở camera. Cho phép quyền camera trong trình duyệt và thử lại.');
          }
        }
      } catch {
        if (!cancelled) {
          setError('Không thể mở camera. Cho phép quyền camera trong trình duyệt và thử lại.');
        }
      }
    })();

    return () => {
      cancelled = true;
      const inst = scannerRef.current;
      scannerRef.current = null;
      if (inst) {
        void inst
          .stop()
          .catch(() => {})
          .then(() => {
            try {
              inst.clear();
            } catch {
              /* ignore */
            }
          });
      }
    };
  }, [scannerDivId]);

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
              <Button variant="outline" size="sm" onClick={onClose}>
                Đóng
              </Button>
            </div>
          ) : (
            <>
              <div id={scannerDivId} className="rounded-lg overflow-hidden min-h-[200px]" />
              <p className="text-xs text-muted-foreground text-center mt-3">
                Giữ mã trong khung. Trên máy tính, đưa mã gần webcam và đủ sáng.
              </p>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
