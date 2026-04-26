import { useState } from 'react';
import QRCode from 'qrcode';
import { Loader2, QrCode } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { pondQrPayload } from '@/lib/fieldAuthHelpers';

export default function QRBatchDownload({ ponds }) {
  const [loading, setLoading] = useState(false);

  const handleBatchDownload = async () => {
    if (ponds.length === 0) return;
    setLoading(true);

    // Tạo 1 canvas lớn ghép tất cả QR: 4 cột
    const COLS = 4;
    const CELL_W = 220;
    const CELL_H = 260;
    const rows = Math.ceil(ponds.length / COLS);
    const canvasW = COLS * CELL_W;
    const canvasH = rows * CELL_H + 60; // header

    const canvas = document.createElement('canvas');
    canvas.width = canvasW;
    canvas.height = canvasH;
    const ctx = canvas.getContext('2d');

    // Background
    ctx.fillStyle = '#f8fafc';
    ctx.fillRect(0, 0, canvasW, canvasH);

    // Header
    ctx.fillStyle = '#1e3a5f';
    ctx.fillRect(0, 0, canvasW, 50);
    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 18px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(`DANH SÁCH QR MÃ AO (${ponds.length} ao)`, canvasW / 2, 32);

    // Vẽ từng QR
    for (let i = 0; i < ponds.length; i++) {
      const pond = ponds[i];
      const payload = pondQrPayload(pond?.code);
      if (!payload) continue;
      const col = i % COLS;
      const row = Math.floor(i / COLS);
      const x = col * CELL_W + 10;
      const y = row * CELL_H + 60;

      // Card background
      ctx.fillStyle = '#ffffff';
      ctx.beginPath();
      ctx.roundRect(x, y, CELL_W - 20, CELL_H - 20, 8);
      ctx.fill();
      ctx.strokeStyle = '#e2e8f0';
      ctx.lineWidth = 1;
      ctx.stroke();

      // QR
      const qrCanvas = document.createElement('canvas');
      await QRCode.toCanvas(qrCanvas, payload, {
        width: 140,
        margin: 1,
        color: { dark: '#1e3a5f', light: '#ffffff' },
        errorCorrectionLevel: 'M',
      });
      const qrX = x + (CELL_W - 20 - 140) / 2;
      ctx.drawImage(qrCanvas, qrX, y + 10, 140, 140);

      // Text
      ctx.fillStyle = '#1e3a5f';
      ctx.font = 'bold 13px sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText(pond.code, x + (CELL_W - 20) / 2, y + 162);

      ctx.fillStyle = '#64748b';
      ctx.font = '11px sans-serif';
      const name = pond.owner_name?.length > 18 ? pond.owner_name.slice(0, 17) + '…' : (pond.owner_name || '');
      ctx.fillText(name, x + (CELL_W - 20) / 2, y + 178);

      ctx.fillStyle = '#94a3b8';
      ctx.font = '10px monospace';
      ctx.fillText(payload, x + (CELL_W - 20) / 2, y + 194);
    }

    const dataUrl = canvas.toDataURL('image/png');
    const a = document.createElement('a');
    a.href = dataUrl;
    a.download = `QR_TatCaAo_${new Date().toISOString().slice(0, 10)}.png`;
    a.click();

    setLoading(false);
  };

  return (
    <Button
      onClick={handleBatchDownload}
      disabled={loading || ponds.length === 0}
      variant="outline"
      className="flex items-center gap-2"
    >
      {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <QrCode className="w-4 h-4" />}
      {loading ? 'Đang tạo...' : `Tải hàng loạt (${ponds.length} ao)`}
    </Button>
  );
}