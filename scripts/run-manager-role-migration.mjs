/**
 * Thêm vai trò Giám sát vùng (manager) + cột region_codes trên field_accounts.
 * Cần .env: DB_PASSWORD hoặc DATABASE_URL (+ VITE_SUPABASE_URL để suy ref).
 *
 *   npm run migrate:manager-role
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

const migrationPath = resolve(__dirname, 'migrations/20260527_field_accounts_manager_role.sql');
const sql = readFileSync(migrationPath, 'utf8');

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
  const user = `postgres.${ref}`;
  const pass = encodeURIComponent(password);
  const hosts = process.env.SUPABASE_DB_POOLER_HOST
    ? [process.env.SUPABASE_DB_POOLER_HOST]
    : [
        'aws-0-ap-southeast-1.pooler.supabase.com',
        'aws-0-ap-northeast-1.pooler.supabase.com',
        'aws-0-us-east-1.pooler.supabase.com',
        'aws-0-eu-west-1.pooler.supabase.com',
      ];
  const ports = process.env.SUPABASE_DB_POOLER_PORT
    ? [process.env.SUPABASE_DB_POOLER_PORT]
    : ['5432', '6543'];
  const out = [`postgresql://postgres:${pass}@db.${ref}.supabase.co:5432/postgres`];
  for (const host of hosts) {
    for (const port of ports) {
      out.push(`postgresql://${user}:${pass}@${host}:${port}/postgres`);
    }
  }
  return out;
}

async function connectPg() {
  const candidates = connectionCandidates();
  let lastErr;
  for (const connectionString of candidates) {
    const client = new pg.Client({
      connectionString,
      ssl: { rejectUnauthorized: false },
    });
    try {
      await client.connect();
      return client;
    } catch (e) {
      lastErr = e;
    }
  }
  throw lastErr || new Error('Không kết nối được Postgres (kiểm tra DB_PASSWORD / pooler region).');
}

async function main() {
  console.log('Đang chạy migration Giám sát vùng (region_codes + manager role)...');
  const client = await connectPg();

  const before = await client.query(`
    select column_name
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'field_accounts'
      and column_name = 'region_codes'
  `);
  console.log('Cột region_codes trước migration:', before.rows.length ? 'đã có' : 'chưa có');

  await client.query(sql);

  const after = await client.query(`
    select column_name
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'field_accounts'
      and column_name = 'region_codes'
  `);
  if (!after.rows.length) {
    throw new Error('Migration chưa tạo được cột region_codes');
  }

  const roles = await client.query(`
    select pg_get_constraintdef(c.oid) as def
    from pg_constraint c
    join pg_class t on t.oid = c.conrelid
    join pg_namespace n on n.oid = t.relnamespace
    where n.nspname = 'public'
      and t.relname = 'field_accounts'
      and c.conname = 'field_accounts_role_check'
  `);
  console.log('Ràng buộc role:', roles.rows[0]?.def || '(không có)');

  await client.end();
  console.log('Xong. Có thể tạo tài khoản Giám sát vùng trên /admin.');
}

main().catch((e) => {
  console.error(e.message || e);
  process.exit(1);
});
