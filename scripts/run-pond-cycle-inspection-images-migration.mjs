/**
 * Thêm cột pond_cycles.inspection_images (ảnh kiểm định — URL Cloudflare).
 *
 *   node scripts/run-pond-cycle-inspection-images-migration.mjs
 */

import { readFileSync, existsSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import dns from 'node:dns';
import pg from 'pg';

dns.setDefaultResultOrder('ipv6first');

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = resolve(__dirname, '..');

function loadEnvFile(name) {
  const p = resolve(root, name);
  if (!existsSync(p)) return;
  for (const line of readFileSync(p, 'utf8').split(/\r?\n/)) {
    const t = line.trim();
    if (!t || t.startsWith('#')) continue;
    const eq = t.indexOf('=');
    if (eq <= 0) continue;
    const key = t.slice(0, eq).trim();
    const val = t.slice(eq + 1).trim();
    if (key && process.env[key] === undefined) process.env[key] = val;
  }
}

loadEnvFile('.env');
loadEnvFile('.env.example');

const sql = readFileSync(
  resolve(__dirname, 'migrations/20260725_pond_cycle_inspection_images.sql'),
  'utf8'
);

function projectRefFromSupabaseUrl(url) {
  try {
    const host = new URL(url).hostname;
    const m = host.match(/^([a-z0-9]+)\.supabase\.co$/i);
    return m?.[1] || null;
  } catch {
    return null;
  }
}

function connectionCandidates() {
  if (process.env.DATABASE_URL) return [process.env.DATABASE_URL];
  const password = process.env.DB_PASSWORD;
  const supabaseUrl = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
  const ref = process.env.SUPABASE_PROJECT_REF || projectRefFromSupabaseUrl(supabaseUrl);
  if (!password || !ref) {
    throw new Error('Thiếu DB_PASSWORD (hoặc DATABASE_URL). Thêm vào .env cùng VITE_SUPABASE_URL.');
  }
  const pass = encodeURIComponent(password);
  return [`postgresql://postgres:${pass}@db.${ref}.supabase.co:5432/postgres`];
}

async function main() {
  const client = new pg.Client({
    connectionString: connectionCandidates()[0],
    ssl: { rejectUnauthorized: false },
  });
  await client.connect();
  console.log('Chạy migration inspection_images…');
  await client.query(sql);
  const check = await client.query(`
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'pond_cycles' and column_name = 'inspection_images'
  `);
  if (!check.rows.length) throw new Error('Cột inspection_images chưa được tạo.');
  await client.end();
  console.log('Xong — pond_cycles.inspection_images đã sẵn sàng.');
}

main().catch((e) => {
  console.error(e.message || e);
  process.exit(1);
});
