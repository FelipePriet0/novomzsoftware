import { createClient } from '@supabase/supabase-js';
import type { Database } from './types';

// Preferir variáveis de ambiente em produção
const ENV_URL = (import.meta as any)?.env?.VITE_SUPABASE_URL as string | undefined;
const ENV_ANON = (import.meta as any)?.env?.VITE_SUPABASE_ANON_KEY as string | undefined;

// Fallback para valores existentes apenas para desenvolvimento local
const FALLBACK_URL = "https://juxpvvpogpolspxnecsf.supabase.co";
const FALLBACK_ANON = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imp1eHB2dnBvZ3BvbHNweG5lY3NmIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTQ3MTA5OTIsImV4cCI6MjA3MDI4Njk5Mn0.sWhfCj4wT2pa3sU9o5kiE5lVhm67Emxft7eTA4qkdtQ";

const SUPABASE_URL = ENV_URL || FALLBACK_URL;
const SUPABASE_PUBLISHABLE_KEY = ENV_ANON || FALLBACK_ANON;

// Import the supabase client like this:
// import { supabase } from "@/integrations/supabase/client";

export const supabase = createClient<Database>(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY, {
  auth: {
    storage: typeof window !== 'undefined' ? window.localStorage : undefined,
    persistSession: true,
    autoRefreshToken: true,
  }
});
