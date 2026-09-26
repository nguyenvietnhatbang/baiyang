/**
 * Upload ảnh lên Cloudinary (unsigned preset — không lộ API secret trên browser).
 *
 * Env (Vite):
 *   VITE_CLOUDINARY_CLOUD_NAME
 *   VITE_CLOUDINARY_UPLOAD_PRESET
 */

const FALLBACK_CLOUD = 'dfogqidg9';
const FALLBACK_PRESET = 'aoca_upload';

function cloudName() {
  return String(import.meta.env.VITE_CLOUDINARY_CLOUD_NAME || FALLBACK_CLOUD).trim();
}

function uploadPreset() {
  return String(import.meta.env.VITE_CLOUDINARY_UPLOAD_PRESET || FALLBACK_PRESET).trim();
}

export function isCloudinaryConfigured() {
  return Boolean(cloudName() && uploadPreset());
}

/**
 * @param {File} file
 * @returns {Promise<{ url: string, publicId: string, width?: number, height?: number, bytes?: number, format?: string, originalFilename?: string }>}
 */
export async function uploadImageToCloudinary(file) {
  const cloud = cloudName();
  const preset = uploadPreset();
  if (!cloud || !preset) {
    throw new Error('Chưa cấu hình Cloudinary.');
  }
  if (!file || !(file instanceof Blob)) {
    throw new Error('Thiếu file ảnh.');
  }

  const form = new FormData();
  form.append('file', file);
  form.append('upload_preset', preset);
  // Không gửi folder/tags — unsigned preset đã cấu hình sẵn folder baiyang/kiem-dinh

  const endpoint = `https://api.cloudinary.com/v1_1/${cloud}/image/upload`;
  const res = await fetch(endpoint, { method: 'POST', body: form });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(data?.error?.message || `Upload Cloudinary thất bại (${res.status})`);
  }
  const url = data.secure_url || data.url;
  if (!url) throw new Error('Cloudinary không trả URL ảnh.');

  return {
    url,
    publicId: data.public_id,
    width: data.width,
    height: data.height,
    bytes: data.bytes,
    format: data.format,
    originalFilename: data.original_filename || (file instanceof File ? file.name : 'ảnh'),
  };
}

/**
 * Upload nhiều file tuần tự.
 * @param {File[]} files
 * @param {{ onProgress?: (done: number, total: number) => void }} [opts]
 */
export async function uploadImagesToCloudinary(files, opts = {}) {
  const list = (files || []).filter((f) => f && String(f.type || '').startsWith('image/'));
  if (list.length === 0) throw new Error('Không có file ảnh hợp lệ.');
  const out = [];
  for (let i = 0; i < list.length; i += 1) {
    // eslint-disable-next-line no-await-in-loop
    const r = await uploadImageToCloudinary(list[i]);
    out.push(r);
    opts.onProgress?.(i + 1, list.length);
  }
  return out;
}
