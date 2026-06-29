import QRCode from 'qrcode';

export const APP_LOGO_URL = '/logo.jpg';

let logoImageCache = null;

function loadLogo() {
  if (logoImageCache) return Promise.resolve(logoImageCache);
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => {
      logoImageCache = img;
      resolve(img);
    };
    img.onerror = reject;
    img.src = APP_LOGO_URL;
  });
}

/** Vẽ QR lên canvas và chèn logo Baiyang VN ở giữa. */
export async function renderQrWithLogo(
  canvas,
  payload,
  {
    width = 180,
    margin = 2,
    dark = '#1e3a5f',
    light = '#ffffff',
    logoScale = 0.22,
  } = {}
) {
  await QRCode.toCanvas(canvas, payload, {
    width,
    margin,
    color: { dark, light },
    errorCorrectionLevel: 'H',
  });

  const ctx = canvas.getContext('2d');
  if (!ctx) return;

  try {
    const logo = await loadLogo();
    const size = canvas.width;
    const logoSize = Math.round(size * logoScale);
    const x = (size - logoSize) / 2;
    const y = (size - logoSize) / 2;
    const pad = Math.max(3, Math.round(logoSize * 0.1));

    ctx.fillStyle = light;
    if (typeof ctx.roundRect === 'function') {
      ctx.beginPath();
      ctx.roundRect(x - pad, y - pad, logoSize + pad * 2, logoSize + pad * 2, 6);
      ctx.fill();
    } else {
      ctx.fillRect(x - pad, y - pad, logoSize + pad * 2, logoSize + pad * 2);
    }

    ctx.drawImage(logo, x, y, logoSize, logoSize);
  } catch {
    // QR vẫn dùng được nếu logo chưa tải được
  }
}
