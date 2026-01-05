
import { createClient } from '@supabase/supabase-js';

// Explicitly access Vite environment variables to ensure static replacement during build.
// Vite replaces `import.meta.env.VITE_KEY` strings statically. Dynamic access (e.g. env[key]) often fails in production.
// We guard the access to prevent runtime crashes if import.meta.env is undefined in some environments.

// @ts-ignore
const viteSupabaseUrl = (typeof import.meta !== 'undefined' && import.meta.env) ? import.meta.env.VITE_SUPABASE_URL : undefined;
// @ts-ignore
const viteSupabaseKey = (typeof import.meta !== 'undefined' && import.meta.env) ? import.meta.env.VITE_SUPABASE_ANON_KEY : undefined;

// Fallback for non-Vite environments (e.g. standard Node.js)
const processSupabaseUrl = typeof process !== 'undefined' && process.env ? process.env.SUPABASE_URL : undefined;
const processSupabaseKey = typeof process !== 'undefined' && process.env ? process.env.SUPABASE_ANON_KEY : undefined;

const supabaseUrl = viteSupabaseUrl || processSupabaseUrl || '';
const supabaseAnonKey = viteSupabaseKey || processSupabaseKey || '';

// Export a helper to check if we are in "Online" mode
export const isSupabaseConfigured = () => {
  return !!supabaseUrl && !!supabaseAnonKey && supabaseUrl !== 'undefined';
};

if (!isSupabaseConfigured()) {
  console.warn("Supabase credentials missing. App running in Offline/Demo mode.");
}

// Create client only if keys exist to avoid crash, otherwise create a dummy client or let it fail gracefully later
export const supabase = isSupabaseConfigured()
  ? createClient(supabaseUrl, supabaseAnonKey)
  : createClient('https://placeholder.supabase.co', 'placeholder');
