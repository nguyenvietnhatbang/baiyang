/**
 * Nhập dữ liệu demo hàng loạt qua Supabase API (service role).
 *
 * .env: VITE_SUPABASE_URL (hoặc SUPABASE_URL) + SUPABASE_SERVICE_ROLE_KEY
 *
 * Tuỳ chọn:
 *   BULK_AGENCIES=8 BULK_HOUSEHOLDS=15 BULK_PONDS_PER_HOUSE=5 npm run seed:bulk
 *
 * Demo cố định (16 ao): dùng scripts/seed_standard_demo.sql trong SQL Editor.
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

const numAgencies = Math.min(500, Math.max(1, Number(process.env.BULK_AGENCIES || 5)));
const numHouseholds = Math.min(500, Math.max(1, Number(process.env.BULK_HOUSEHOLDS || 10)));
const numPondsPerHouse = Math.min(50, Math.max(1, Number(process.env.BULK_PONDS_PER_HOUSE || 4)));

if (!url || !serviceKey) {
  console.error(
    'Thiếu SUPABASE_URL (hoặc VITE_SUPABASE_URL) và SUPABASE_SERVICE_ROLE_KEY trong .env.'
  );
  process.exit(1);
}

const supabase = createClient(url, serviceKey, {
  auth: { autoRefreshToken: false, persistSession: false },
});

function chunk(arr, n) {
  const out = [];
  for (let i = 0; i < arr.length; i += n) out.push(arr.slice(i, i + n));
  return out;
}

const pad2 = (n) => String(n).padStart(2, '0');
const pad3 = (n) => String(n).padStart(3, '0');

async function main() {
  const { data: seasonRow, error: seasonErr } = await supabase
    .from('seasons')
    .select('id')
    .eq('code', 'VU-2026-1')
    .maybeSingle();

  let seasonId = seasonRow?.id;
  if (!seasonId) {
    const { data: anySeason } = await supabase
      .from('seasons')
      .select('id')
      .eq('active', true)
      .limit(1)
      .maybeSingle();
    seasonId = anySeason?.id;
  }
  if (!seasonId) {
    console.error('Không tìm thấy season. Chạy supabase-schema.sql hoặc thêm bản ghi trong seasons.');
    process.exit(1);
  }
  if (seasonErr && !seasonRow) {
    console.warn('Gợi ý: kiểm tra bảng seasons.', seasonErr.message);
  }

  const pondsToInsert = [];
  let agenciesUpserted = 0;
  let householdsUpserted = 0;

  for (let ai = 1; ai <= numAgencies; ai++) {
    const seg = pad2(ai);
    const agencyCode = `BULK-${seg}`;
    const { data: agency, error: agErr } = await supabase
      .from('agencies')
      .upsert(
        {
          code: agencyCode,
          name: `Đại lý nhập liệu ${seg}`,
          pond_code_segment: seg,
          phone: `090${String((ai * 1000007) % 100000000).padStart(8, '0')}`,
          active: true,
        },
        { onConflict: 'code' }
      )
      .select('id, code, pond_code_segment')
      .single();

    if (agErr || !agency) {
      console.error('Lỗi agency', agencyCode, agErr?.message);
      process.exit(1);
    }
    agenciesUpserted++;

    for (let hi = 1; hi <= numHouseholds; hi++) {
      const hhSeg = pad3(hi);
      const owner = `Hộ bulk ${seg}-${hhSeg}`;
      const { data: hh, error: hhErr } = await supabase
        .from('households')
        .upsert(
          {
            agency_id: agency.id,
            region_code: '17',
            household_segment: hhSeg,
            name: owner,
            address: 'Xã nhập liệu — TB',
            active: true,
          },
          { onConflict: 'agency_id,household_segment' }
        )
        .select('id')
        .single();

      if (hhErr || !hh) {
        console.error('Lỗi household', agencyCode, hhSeg, hhErr?.message);
        process.exit(1);
      }
      householdsUpserted++;

      for (let pi = 1; pi <= numPondsPerHouse; pi++) {
        const pondCode = `17-${seg}-${hhSeg}-${pad2(pi)}`;
        const status = (hi + pi) % 3 === 0 ? 'CT' : 'CC';
        const area = 800 + ((hi * 17 + pi * 41) % 2200);
        const depth = 1.5 + (pi % 5) * 0.15;
        let expectedHarvestDate = null;
        if (status === 'CC') {
          const d = new Date();
          d.setDate(d.getDate() + 20 + ((hi + pi) % 40));
          expectedHarvestDate = d.toISOString().slice(0, 10);
        }
        const expectedYield =
          status === 'CC'
            ? Math.round(area * 3.5 + (hi % 10))
            : Math.round(area * 2.8);

        pondsToInsert.push({
          code: pondCode,
          household_id: hh.id,
          owner_name: owner,
          agency_code: agencyCode,
          season_id: seasonId,
          area,
          depth,
          location: `Khu bulk ${seg}`,
          status,
          expected_harvest_date: expectedHarvestDate,
          expected_yield: expectedYield,
          ph_min: 6.5,
          ph_max: 8.5,
          temp_min: 25,
          temp_max: 32,
          qr_code: `POND:${pondCode}:bulk`,
        });
      }
    }
  }

  for (const batch of chunk(pondsToInsert, 80)) {
    const { error } = await supabase.from('ponds').upsert(batch, { onConflict: 'code' });
    if (error) {
      console.error('Lỗi insert ao:', error.message);
      process.exit(1);
    }
  }

  console.log(
    `Xong: ${agenciesUpserted} đại lý, ${householdsUpserted} hộ, ${pondsToInsert.length} ao (upsert theo mã ao; chạy lại sẽ cập nhật bản ghi trùng mã).`
  );
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
