import { createClient } from "@supabase/supabase-js"
import { supabaseConfig } from "./supabase-config"

if (!supabaseConfig.url || !supabaseConfig.anonKey) {
  throw new Error("Set NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY to configure Supabase")
}

export const supabase = createClient(supabaseConfig.url, supabaseConfig.anonKey)
