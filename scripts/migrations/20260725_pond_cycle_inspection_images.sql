-- Ảnh kiểm định gắn chu kỳ (URL Cloudflare / CDN). Mảng JSON: [{id,url,name,created_at}]

alter table public.pond_cycles
  add column if not exists inspection_images jsonb not null default '[]'::jsonb;

comment on column public.pond_cycles.inspection_images is
  'Danh sách ảnh kiểm định (URL). VD: [{"id":"...","url":"https://...","name":"ks-1.jpg","created_at":"..."}]';
