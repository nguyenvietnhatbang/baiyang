export const appParams = {
  supabaseUrl: import.meta.env.VITE_SUPABASE_URL || '',
  fromUrl: typeof window !== 'undefined' ? window.location.href : '',
};
