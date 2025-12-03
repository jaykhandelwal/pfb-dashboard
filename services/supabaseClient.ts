import { createClient } from '@supabase/supabase-js';

// These should be environment variables in production
// REACT_APP_SUPABASE_URL or VITE_SUPABASE_URL
const supabaseUrl = process.env.SUPABASE_URL || '';
const supabaseAnonKey = process.env.SUPABASE_ANON_KEY || '';

if (!supabaseUrl || !supabaseAnonKey) {
  console.warn("Supabase credentials missing. Check environment variables.");
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey);