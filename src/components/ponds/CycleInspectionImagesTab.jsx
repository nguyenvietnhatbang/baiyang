import { useEffect, useMemo, useRef, useState } from 'react';
import { ImagePlus, Link2, Trash2, ExternalLink, Images, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { base44 } from '@/api/base44Client';
import { formatSupabaseError } from '@/lib/supabaseErrors';
import { isCloudinaryConfigured, uploadImagesToCloudinary } from '@/lib/cloudinaryUpload';

function newImageId() {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) return crypto.randomUUID();
  return `img_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
}

function normalizeImages(raw) {
  if (!Array.isArray(raw)) return [];
  return raw
    .map((item) => {
      if (typeof item === 'string') {
        const url = item.trim();
        if (!url) return null;
        return { id: newImageId(), url, name: url.split('/').pop() || 'ảnh', created_at: new Date().toISOString() };
      }
      const url = String(item?.url || '').trim();
      if (!url) return null;
      return {
        id: item.id || newImageId(),
        url,
        name: item.name || url.split('/').pop() || 'ảnh',
        public_id: item.public_id || null,
        created_at: item.created_at || new Date().toISOString(),
      };
    })
    .filter(Boolean);
}

function parseUrlLines(text) {
  return String(text || '')
    .split(/\r?\n|,|\s+/)
    .map((s) => s.trim())
    .filter((s) => /^https?:\/\//i.test(s));
}

/**
 * Tab ảnh kiểm định — upload Cloudinary + lưu URL trên pond_cycles.inspection_images.
 */
export default function CycleInspectionImagesTab({ cycle, canEditDelete = false, onUpdated }) {
  const fileRef = useRef(null);
  const [images, setImages] = useState(() => normalizeImages(cycle?.inspection_images));
  const [urlDraft, setUrlDraft] = useState('');
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState('');
  const [error, setError] = useState('');
  const [preview, setPreview] = useState(null);

  const cloudReady = isCloudinaryConfigured();

  useEffect(() => {
    setImages(normalizeImages(cycle?.inspection_images));
  }, [cycle?.id, cycle?.inspection_images]);

  const count = images.length;

  const persist = async (next) => {
    if (!cycle?.id) return;
    setSaving(true);
    setError('');
    try {
      await base44.entities.PondCycle.update(cycle.id, { inspection_images: next });
      setImages(next);
      onUpdated?.(next);
    } catch (e) {
      setError(formatSupabaseError(e));
    }
    setSaving(false);
  };

  const handleAddUrls = async () => {
    const urls = parseUrlLines(urlDraft);
    if (urls.length === 0) {
      setError('Dán ít nhất một URL ảnh (http/https), mỗi dòng một link.');
      return;
    }
    const existing = new Set(images.map((i) => i.url));
    const added = urls
      .filter((u) => !existing.has(u))
      .map((url) => ({
        id: newImageId(),
        url,
        name: url.split('/').pop()?.split('?')[0] || 'ảnh',
        created_at: new Date().toISOString(),
      }));
    if (added.length === 0) {
      setError('URL đã có trong danh sách.');
      return;
    }
    setUrlDraft('');
    await persist([...images, ...added]);
  };

  const handleRemove = async (id) => {
    const next = images.filter((i) => i.id !== id);
    await persist(next);
  };

  const handleLocalFiles = async (e) => {
    const files = [...(e.target.files || [])].filter((f) => f.type.startsWith('image/'));
    e.target.value = '';
    if (files.length === 0) return;

    if (!cloudReady) {
      setError('Cloudinary chưa sẵn sàng. Reload trang rồi thử lại.');
      return;
    }

    setUploading(true);
    setError('');
    setUploadProgress(`0/${files.length}`);
    try {
      const uploaded = await uploadImagesToCloudinary(files, {
        onProgress: (done, total) => setUploadProgress(`${done}/${total}`),
      });
      const existing = new Set(images.map((i) => i.url));
      const added = uploaded
        .filter((u) => !existing.has(u.url))
        .map((u) => ({
          id: newImageId(),
          url: u.url,
          name: u.originalFilename || u.publicId || 'ảnh',
          public_id: u.publicId || null,
          created_at: new Date().toISOString(),
        }));
      if (added.length === 0) {
        setError('Ảnh đã có trong danh sách.');
      } else {
        await persist([...images, ...added]);
      }
    } catch (err) {
      setError(err?.message || 'Upload Cloudinary thất bại.');
    }
    setUploading(false);
    setUploadProgress('');
  };

  const hint = useMemo(() => {
    if (!canEditDelete) return 'Chỉ xem ảnh kiểm định đã lưu.';
    return 'Chọn nhiều ảnh để tải lên Cloudinary (res.cloudinary.com) và lưu vào chu kỳ.';
  }, [canEditDelete]);

  const busy = saving || uploading;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <h3 className="text-sm font-semibold text-foreground flex items-center gap-2">
            <Images className="w-4 h-4 text-emerald-600" />
            Ảnh kiểm định
          </h3>
          <p className="text-xs text-muted-foreground mt-0.5">{hint}</p>
        </div>
        <span className="text-xs font-semibold text-muted-foreground">{count} ảnh</span>
      </div>

      {error ? (
        <p className="text-xs text-amber-800 bg-amber-50 border border-amber-200 rounded px-2 py-1.5">{error}</p>
      ) : null}

      {canEditDelete ? (
        <div className="rounded-xl border border-border bg-muted/20 p-3 space-y-3">
          <div className="flex flex-wrap gap-2 items-center">
            <Button
              type="button"
              size="sm"
              className="gap-1.5"
              onClick={() => fileRef.current?.click()}
              disabled={busy}
            >
              {uploading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <ImagePlus className="w-3.5 h-3.5" />}
              {uploading ? `Đang tải lên Cloudinary ${uploadProgress}…` : 'Tải ảnh lên Cloudinary'}
            </Button>
            <span className="text-[11px] text-muted-foreground">Lưu tại res.cloudinary.com/dfogqidg9</span>
            <input
              ref={fileRef}
              type="file"
              accept="image/*"
              multiple
              className="hidden"
              onChange={handleLocalFiles}
            />
          </div>

          <div>
            <Label className="text-xs">Hoặc dán URL ảnh — mỗi dòng một link</Label>
            <Textarea
              className="mt-1 min-h-[72px] text-sm"
              placeholder={'https://res.cloudinary.com/dfogqidg9/...'}
              value={urlDraft}
              onChange={(e) => setUrlDraft(e.target.value)}
              disabled={busy}
            />
          </div>
          <Button type="button" size="sm" variant="outline" className="gap-1.5" onClick={handleAddUrls} disabled={busy}>
            <Link2 className="w-3.5 h-3.5" />
            {saving ? 'Đang lưu…' : 'Thêm URL'}
          </Button>
        </div>
      ) : null}

      {images.length === 0 ? (
        <div className="rounded-xl border border-dashed border-border py-12 text-center text-sm text-muted-foreground">
          Chưa có ảnh kiểm định cho chu kỳ này.
        </div>
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
          {images.map((img) => (
            <div key={img.id} className="group relative rounded-lg border border-border overflow-hidden bg-card">
              <button
                type="button"
                className="block w-full aspect-square bg-muted/40"
                onClick={() => setPreview(img)}
                title={img.name}
              >
                <img src={img.url} alt={img.name} className="w-full h-full object-cover" loading="lazy" />
              </button>
              <div className="px-2 py-1.5 flex items-center gap-1 border-t border-border">
                <p className="text-[11px] font-medium truncate flex-1 min-w-0" title={img.name}>
                  {img.name}
                </p>
                <a
                  href={img.url}
                  target="_blank"
                  rel="noreferrer"
                  className="text-muted-foreground hover:text-foreground p-0.5"
                  title="Mở ảnh"
                >
                  <ExternalLink className="w-3.5 h-3.5" />
                </a>
                {canEditDelete ? (
                  <button
                    type="button"
                    className="text-red-600 hover:text-red-700 p-0.5 disabled:opacity-50"
                    disabled={busy}
                    onClick={() => handleRemove(img.id)}
                    title="Xóa"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                ) : null}
              </div>
            </div>
          ))}
        </div>
      )}

      {preview ? (
        <div
          className="fixed inset-0 z-[100] bg-black/70 flex items-center justify-center p-4"
          onClick={() => setPreview(null)}
          role="presentation"
        >
          <div
            className="max-w-[min(96vw,56rem)] max-h-[90vh] bg-background rounded-xl overflow-hidden shadow-xl"
            onClick={(e) => e.stopPropagation()}
            role="dialog"
          >
            <div className="flex items-center justify-between gap-2 px-3 py-2 border-b border-border">
              <p className="text-sm font-semibold truncate">{preview.name}</p>
              <Button type="button" variant="ghost" size="sm" onClick={() => setPreview(null)}>
                Đóng
              </Button>
            </div>
            <img src={preview.url} alt={preview.name} className="max-h-[80vh] w-auto max-w-full mx-auto object-contain" />
          </div>
        </div>
      ) : null}
    </div>
  );
}
