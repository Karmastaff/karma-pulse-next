import { createClient } from '@supabase/supabase-js';

// Setup Mock Supabase Client for Demo purposes
// In a real environment, use process.env.NEXT_PUBLIC_SUPABASE_URL and KEY

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://mock-xyz.supabase.co';
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || 'mock-anon-key';

export const supabase = createClient(supabaseUrl, supabaseAnonKey);
