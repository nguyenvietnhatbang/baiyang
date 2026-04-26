/**
 * Tạo user admin demo (email đã xác nhận) và gán role admin trong public.profiles.
 *
 * Cách 1: Thêm vào .env (cùng thư mục dự án):
 *   SUPABASE_SERVICE_ROLE_KEY=eyJ...   (Dashboard → Project Settings → API → service_role)
 *   (đã có sẵn VITE_SUPABASE_URL thì không cần SUPABASE_URL)
 * Rồi: npm run seed:admin
 *
 * Cách 2: export SUPABASE_URL / VITE_SUPABASE_URL và SUPABASE_SERVICE_ROLE_KEY rồi node scripts/create-demo-admin.mjs
 */

import { readFileSync, existsSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createClient } from '@supabase/supabase-js';

const __dirname = dirname(fileURLToPath(import.meta.url));

function loadDotenvFromProjectRoot() {
  const p = resolve(__dirname, '..', '.env');
  if (!existsSync(p)) return;
  const text = readFileSync(p, 'utf8');
  for (const line of text.split(/\r?\n/)) {
    const t = line.trim();
    if (!t || t.startsWith('#')) continue;
    const eq = t.indexOf('=');
    if (eq <= 0) continue;
    const key = t.slice(0, eq).trim();
    let val = t.slice(eq + 1).trim();
    if (!key) continue;
    if (process.env[key] === undefined) process.env[key] = val;
  }
}

loadDotenvFromProjectRoot();

const url = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

const email = process.env.SEED_ADMIN_EMAIL || 'admin@demo.mypond.local';
const password = process.env.SEED_ADMIN_PASSWORD || 'DemoAdmin123!';

if (!url || !serviceKey) {
  console.error(
    'Thiếu biến môi trường: SUPABASE_URL (hoặc VITE_SUPABASE_URL) và SUPABASE_SERVICE_ROLE_KEY.\n' +
      'Lấy service role trong Supabase Dashboard → Project Settings → API.'
  );
  process.exit(1);
}

const supabase = createClient(url, serviceKey, {
  auth: { autoRefreshToken: false, persistSession: false },
});

let uid;

const { data: created, error: createErr } = await supabase.auth.admin.createUser({
  email,
  password,
  email_confirm: true,
  user_metadata: { name: 'Quản trị demo' },
});

if (createErr) {
  const msg = (createErr.message || '').toLowerCase();
  const already =
    msg.includes('already') ||
    msg.includes('registered') ||
    createErr.code === 'email_exists';
  if (!already) {
    console.error('Không tạo được user:', createErr.message);
    process.exit(1);
  }
  const { data: listData, error: listErr } = await supabase.auth.admin.listUsers({ page: 1, perPage: 1000 });
  if (listErr) {
    console.error('Không liệt kê được user:', listErr.message);
    process.exit(1);
  }
  const existing = (listData?.users || []).find((u) => (u.email || '').toLowerCase() === email.toLowerCase());
  if (!existing) {
    console.error(
      'Email đã tồn tại nhưng không tìm thấy trong danh sách user. Chạy SQL (thay <uuid>):\n' +
        `  insert into public.profiles (id, role, display_name) values ('<uuid>', 'admin', 'Quản trị demo')\n` +
        `  on conflict (id) do update set role = 'admin', display_name = excluded.display_name;`
    );
    process.exit(1);
  }
  uid = existing.id;
  console.log('Tài khoản đã có sẵn — cập nhật profile thành admin:', uid);
} else {
  uid = created.user.id;
}

const { error: upErr } = await supabase.from('profiles').upsert(
  { id: uid, role: 'admin', display_name: 'Quản trị demo' },
  { onConflict: 'id' }
);

if (upErr) {
  console.error('Không upsert được profiles:', upErr.message);
  process.exit(1);
}

console.log('Admin demo — profile.role = admin đã ghi:');
console.log('  Email:   ', email);
console.log('  Mật khẩu:', password);
console.log('  User id: ', uid);
console.log('Đăng xuất / đăng nhập lại trong app để thấy menu Cài đặt.');
