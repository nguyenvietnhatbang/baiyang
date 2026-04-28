/**
 * Client dữ liệu + auth: **chỉ Supabase** (`@supabase/supabase-js`).
 * Không dùng `@base44/sdk` — tên export `base44` là legacy template, mọi `base44.entities.*` đều map sang bảng Postgres qua Supabase client bên dưới.
 */
import { createClient } from '@supabase/supabase-js';
import { flattenPondRow } from '@/lib/pondCycleHelpers';
import { pondCodesEqual } from '@/lib/fieldAuthHelpers';

// Phải đọc trực tiếp import.meta.env.VITE_* — Vite chỉ inject khi tên thuộc tính xuất hiện literal trong mã.
// Gán import.meta.env vào biến rồi dùng env.VITE_* sẽ khiến bundle không có giá trị (luôn như chưa cấu hình).
const rawUrl = import.meta.env.VITE_SUPABASE_URL;
const rawKey = import.meta.env.VITE_SUPABASE_ANON_KEY;
const supabaseUrl = typeof rawUrl === 'string' ? rawUrl.trim() : '';
const supabaseAnonKey = typeof rawKey === 'string' ? rawKey.trim() : '';
export const isSupabaseConfigured = Boolean(supabaseUrl && supabaseAnonKey);

if (!isSupabaseConfigured && import.meta.env.DEV) {
  console.warn(
    '[my-pond-app] Chưa cấu hình Supabase: thêm VITE_SUPABASE_URL và VITE_SUPABASE_ANON_KEY vào file .env (xem .env.example).'
  );
} else if (isSupabaseConfigured && import.meta.env.DEV && supabaseAnonKey && !supabaseAnonKey.startsWith('eyJ')) {
  console.warn(
    '[my-pond-app] VITE_SUPABASE_ANON_KEY nên là JWT anon (chuỗi dài bắt đầu bằng eyJ...) từ Dashboard → Project Settings → API. ' +
      'Key dạng sb_publishable_... thường không dùng được với @supabase/supabase-js; hãy copy đúng mục anon / legacy anon public.'
  );
}

const supabase = createClient(
  supabaseUrl || 'https://placeholder.supabase.co',
  supabaseAnonKey || 'placeholder-key',
  { auth: { persistSession: true, autoRefreshToken: true } }
);

const tableMap = {
  Agency: 'agencies',
  Pond: 'ponds',
  PondCycle: 'pond_cycles',
  PondLog: 'pond_logs',
  HarvestRecord: 'harvest_records',
  Household: 'households',
  RegionCode: 'region_codes',
  Season: 'seasons',
  StockingBatch: 'stocking_batches',
  PlanAdjustment: 'plan_adjustments',
  Profile: 'profiles',
};

const mapSortColumn = (column) => {
  if (column === 'updated_date') return 'updated_at';
  if (column === 'created_date') return 'created_at';
  return column;
};

const applySortAndLimit = (query, sort, limit) => {
  let nextQuery = query;
  if (sort) {
    const isDesc = sort.startsWith('-');
    const rawColumn = isDesc ? sort.slice(1) : sort;
    const column = mapSortColumn(rawColumn);
    nextQuery = nextQuery.order(column, { ascending: !isDesc, nullsFirst: false });
  }
  if (typeof limit === 'number') {
    nextQuery = nextQuery.limit(limit);
  }
  return nextQuery;
};

const configError = new Error('Supabase is not configured. Create .env from .env.example and set VITE_SUPABASE_URL + VITE_SUPABASE_ANON_KEY.');

/** Khi chạy không có Supabase, `me()` luôn trả dev user; cờ này để đăng xuất “ảo” vẫn thấy trang login. */
const DEV_LOGGED_OUT_KEY = 'mypond_dev_logged_out';

/** Phiên hiện trường (không JWT): payload RPC `field_account_verify`. Ưu tiên localStorage để giữ sau khi đóng tab. */
const FIELD_SESSION_STORAGE_KEY = 'mypond_field_session_v1';

function clearFieldSessionStorage() {
  try {
    if (typeof localStorage !== 'undefined') localStorage.removeItem(FIELD_SESSION_STORAGE_KEY);
  } catch (_) {
    /* ignore */
  }
  try {
    if (typeof sessionStorage !== 'undefined') sessionStorage.removeItem(FIELD_SESSION_STORAGE_KEY);
  } catch (_) {
    /* ignore */
  }
}

function readFieldSessionPayload() {
  try {
    if (typeof window === 'undefined') return null;
    let raw = null;
    try {
      raw = localStorage.getItem(FIELD_SESSION_STORAGE_KEY);
    } catch (_) {
      /* private mode / disabled */
    }
    if (!raw && typeof sessionStorage !== 'undefined') {
      raw = sessionStorage.getItem(FIELD_SESSION_STORAGE_KEY);
      if (raw) {
        try {
          localStorage.setItem(FIELD_SESSION_STORAGE_KEY, raw);
          sessionStorage.removeItem(FIELD_SESSION_STORAGE_KEY);
        } catch (_) {
          /* giữ trên sessionStorage */
        }
      }
    }
    if (!raw) return null;
    const s = JSON.parse(raw);
    if (!s?.id || !s?.phone || (s.role !== 'agency' && s.role !== 'household_owner')) return null;
    return s;
  } catch {
    return null;
  }
}

function persistFieldSessionRow(row) {
  const raw = JSON.stringify(row);
  try {
    localStorage.setItem(FIELD_SESSION_STORAGE_KEY, raw);
    if (typeof sessionStorage !== 'undefined') sessionStorage.removeItem(FIELD_SESSION_STORAGE_KEY);
  } catch (_) {
    if (typeof sessionStorage === 'undefined') throw new Error('Không lưu được phiên đăng nhập (trình duyệt chặn lưu trữ).');
    sessionStorage.setItem(FIELD_SESSION_STORAGE_KEY, raw);
  }
}

const entityApi = (entityName) => {
  const table = tableMap[entityName];
  return {
    async list(sort = '-created_at', limit) {
      if (!isSupabaseConfigured) return [];
      const query = applySortAndLimit(supabase.from(table).select('*'), sort, limit);
      const { data, error } = await query;
      if (error) throw error;
      return data || [];
    },
    async filter(filters = {}, sort = '-created_at', limit) {
      if (!isSupabaseConfigured) return [];
      let query = supabase.from(table).select('*');
      Object.entries(filters).forEach(([key, value]) => {
        if (value === undefined) return;
        query = query.eq(key, value);
      });
      query = applySortAndLimit(query, sort, limit);
      const { data, error } = await query;
      if (error) throw error;
      return data || [];
    },
    async create(payload) {
      if (!isSupabaseConfigured) throw configError;
      const { data, error } = await supabase.from(table).insert(payload).select().single();
      if (error) throw error;
      return data;
    },
    async update(id, payload) {
      if (!isSupabaseConfigured) throw configError;
      const { data, error } = await supabase.from(table).update(payload).eq('id', id).select().single();
      if (error) throw error;
      return data;
    },
    async delete(id) {
      if (!isSupabaseConfigured) throw configError;
      const { error } = await supabase.from(table).delete().eq('id', id);
      if (error) throw error;
      return true;
    },
  };
};

export async function supabaseRpc(fnName, args = {}) {
  if (!isSupabaseConfigured) throw configError;
  const { data, error } = await supabase.rpc(fnName, args);
  if (error) throw error;
  return data;
}

const defaultAppSettingsRow = {
  id: 1,
  harvest_alert_days: 7,
  bypass_rls: true,
  default_ph_min: 6.5,
  default_ph_max: 8.5,
  default_temp_min: 25,
  default_temp_max: 32,
};

const devUser = {
  id: 'dev-local',
  email: 'dev@local',
  role: 'admin',
  name: 'Dev User',
  profile: null,
  agency_id: null,
  agency_code: null,
  household_id: null,
};

export const base44 = {
  entities: {
    Agency: entityApi('Agency'),
    Pond: {
      ...entityApi('Pond'),
      async listWithHouseholds(sort = '-updated_at', limit = 500) {
        if (!isSupabaseConfigured) return [];
        let q = supabase.from('ponds').select('*, households(*), pond_cycles(*)');
        q = applySortAndLimit(q, sort, limit);
        const { data, error } = await q;
        if (error) throw error;
        return (data || []).map((row) => flattenPondRow(row));
      },
      /** Một ao + toàn bộ chu kỳ (đã flatten active_cycle). */
      async getWithCycles(id) {
        if (!isSupabaseConfigured) return null;
        const { data, error } = await supabase
          .from('ponds')
          .select('*, households(*), pond_cycles(*)')
          .eq('id', id)
          .maybeSingle();
        if (error) throw error;
        if (!data) return null;
        return flattenPondRow(data);
      },
      /** Tra theo mã ao (không phân biệt hoa thường khi cần fallback client). */
      async findByCodeFlattened(code) {
        if (!isSupabaseConfigured) return null;
        const c = String(code || '').trim();
        if (!c) return null;
        const { data, error } = await supabase
          .from('ponds')
          .select('*, households(*), pond_cycles(*)')
          .eq('code', c)
          .maybeSingle();
        if (error && error.code !== 'PGRST116') throw error;
        if (data) return flattenPondRow(data);
        const { data: rows, error: err2 } = await supabase
          .from('ponds')
          .select('*, households(*), pond_cycles(*)')
          .limit(500);
        if (err2) throw err2;
        const row = (rows || []).find((x) => pondCodesEqual(x.code, c));
        return row ? flattenPondRow(row) : null;
      },
    },
    PondCycle: entityApi('PondCycle'),
    PondLog: entityApi('PondLog'),
    HarvestRecord: entityApi('HarvestRecord'),
    Household: entityApi('Household'),
    RegionCode: entityApi('RegionCode'),
    Season: entityApi('Season'),
    StockingBatch: entityApi('StockingBatch'),
    PlanAdjustment: entityApi('PlanAdjustment'),
    Profile: entityApi('Profile'),
    AppSettings: {
      async get() {
        if (!isSupabaseConfigured) return { ...defaultAppSettingsRow };
        const { data, error } = await supabase.from('app_settings').select('*').eq('id', 1).maybeSingle();
        if (error) throw error;
        return data ? { ...defaultAppSettingsRow, ...data } : { ...defaultAppSettingsRow };
      },
      async update(patch) {
        if (!isSupabaseConfigured) throw configError;
        const { data, error } = await supabase.from('app_settings').update(patch).eq('id', 1).select().single();
        if (error) throw error;
        return data ? { ...defaultAppSettingsRow, ...data } : data;
      },
    },
  },
  rpc: supabaseRpc,
  supabase,
  auth: {
    async me() {
      if (!isSupabaseConfigured) {
        try {
          if (typeof sessionStorage !== 'undefined' && sessionStorage.getItem(DEV_LOGGED_OUT_KEY) === '1') {
            return null;
          }
        } catch (_) {
          /* ignore */
        }
        return devUser;
      }
      const { data: { session } } = await supabase.auth.getSession();
      if (session?.user) {
        clearFieldSessionStorage();
        const uid = session.user.id;
        const { data: profile, error: profileErr } = await supabase.from('profiles').select('*').eq('id', uid).maybeSingle();
        if (profileErr) console.warn('profiles:', profileErr.message);
        let agency_code = null;
        if (profile?.agency_id) {
          const { data: ag } = await supabase.from('agencies').select('code').eq('id', profile.agency_id).maybeSingle();
          agency_code = ag?.code ?? null;
        }
        const rawRole = (profile?.role != null ? String(profile.role) : 'household_owner').trim().toLowerCase();
        const role = ['admin', 'agency', 'household_owner'].includes(rawRole) ? rawRole : 'household_owner';
        return {
          id: uid,
          email: session.user.email,
          role,
          name: profile?.display_name || session.user.email || '',
          profile,
          agency_id: profile?.agency_id ?? null,
          agency_code,
          household_id: profile?.household_id ?? null,
        };
      }

      const field = readFieldSessionPayload();
      if (field) {
        let agency_code = null;
        if (field.agency_id) {
          const { data: ag } = await supabase.from('agencies').select('code').eq('id', field.agency_id).maybeSingle();
          agency_code = ag?.code ?? null;
        }
        const profile = {
          id: field.id,
          role: field.role,
          agency_id: field.agency_id,
          household_id: field.household_id,
          display_name: field.display_name,
          phone: field.phone,
        };
        return {
          id: field.id,
          email: `${field.phone}@field.local`,
          role: field.role,
          name: field.display_name || field.phone,
          profile,
          agency_id: field.agency_id ?? null,
          agency_code,
          household_id: field.household_id ?? null,
          fieldSession: true,
        };
      }

      return null;
    },
    async signInWithPassword(email, password) {
      if (!isSupabaseConfigured) throw configError;
      const { error } = await supabase.auth.signInWithPassword({ email: email.trim(), password });
      if (error) throw error;
      clearFieldSessionStorage();
    },
    /** Xóa phiên hiện trường (localStorage) — dùng khi muốn đăng nhập văn phòng trên cùng trình duyệt. */
    clearFieldSession() {
      clearFieldSessionStorage();
    },
    /** Đăng nhập hiện trường: chỉ DB (RPC), không email / không signUp Auth. */
    async signInWithFieldAccount(phoneNormalized, password) {
      if (!isSupabaseConfigured) throw configError;
      const { data, error } = await supabase.rpc('field_account_verify', {
        p_phone: phoneNormalized,
        p_password: password,
      });
      if (error) throw error;
      if (data == null) {
        throw new Error('Sai số điện thoại hoặc mật khẩu');
      }
      const row = typeof data === 'string' ? JSON.parse(data) : data;
      if (!row?.id || !row?.phone) {
        throw new Error('Sai số điện thoại hoặc mật khẩu');
      }
      persistFieldSessionRow(row);
    },
    async signOut() {
      clearFieldSessionStorage();
      await supabase.auth.signOut();
    },
    clearDevLoggedOutFlag() {
      try {
        if (typeof sessionStorage !== 'undefined') sessionStorage.removeItem(DEV_LOGGED_OUT_KEY);
      } catch (_) {
        /* ignore */
      }
    },
    async logout(redirectTo = '/login') {
      if (!isSupabaseConfigured) {
        try {
          if (typeof sessionStorage !== 'undefined') sessionStorage.setItem(DEV_LOGGED_OUT_KEY, '1');
        } catch (_) {
          /* ignore */
        }
      } else {
        clearFieldSessionStorage();
        try {
          await supabase.auth.signOut();
        } catch (e) {
          console.warn('[my-pond-app] signOut:', e);
        }
      }
      if (redirectTo === false) return;
      window.location.href = typeof redirectTo === 'string' && redirectTo.length > 0 ? redirectTo : '/login';
    },
    redirectToLogin() {
      window.location.href = '/login';
    },
  },
};

export { supabase };
