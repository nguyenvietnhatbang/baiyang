/**
 * Client dữ liệu + auth: **chỉ Supabase** (`@supabase/supabase-js`).
 * Không dùng `@base44/sdk` — tên export `base44` là legacy template, mọi `base44.entities.*` đều map sang bảng Postgres qua Supabase client bên dưới.
 */
import { createClient } from '@supabase/supabase-js';

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
        let q = supabase.from('ponds').select('*, households(*)');
        q = applySortAndLimit(q, sort, limit);
        const { data, error } = await q;
        if (error) throw error;
        return (data || []).map((row) => ({
          ...row,
          owner_name: row.owner_name || row.households?.name || '',
        }));
      },
    },
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
      if (!session?.user) return null;
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
    },
    async signInWithPassword(email, password) {
      if (!isSupabaseConfigured) throw configError;
      const { error } = await supabase.auth.signInWithPassword({ email: email.trim(), password });
      if (error) throw error;
    },
    async signOut() {
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
