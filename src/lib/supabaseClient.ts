import { createClient } from '@supabase/supabase-js';

// Fallbacks are required specifically so that `next build` doesn't crash 
// when it evaluates files before secrets are injected in CI/CD.
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://placeholder-during-build.supabase.co';
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || 'placeholder';

export const supabase = createClient(supabaseUrl, supabaseKey);
