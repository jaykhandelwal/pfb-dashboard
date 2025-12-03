import { createClient } from '@supabase/supabase-js';

// Helper to safely access env vars in different environments (Vite vs Standard Node)
const getEnv = (key: string) => {
  // Check process.env (Standard Node/Webpack)
  if (typeof process !== 'undefined' && process.env && process.env[key]) {
    return process.env[key];
  }
  // Check import.meta.env (Vite)
  // @ts-ignore
  if (typeof import.meta !== 'undefined' && import.meta.env && import.meta.env[`VITE_${key}`]) {
    // @ts-ignore
    return import.meta.env[`VITE_${key}`];
  }
  return '';
};

const supabaseUrl = getEnv('SUPABASE_URL');
const supabaseAnonKey = getEnv('SUPABASE_ANON_KEY');

if (!supabaseUrl || !supabaseAnonKey) {
  console.warn("Supabase credentials missing. App will load but database features will fail.");
}

// Create client only if keys exist to avoid crash, otherwise create a dummy client or let it fail gracefully later
export const supabase = (supabaseUrl && supabaseAnonKey) 
  ? createClient(supabaseUrl, supabaseAnonKey)
  : createClient('https://placeholder.supabase.co', 'placeholder'); // Prevents immediate crash on load