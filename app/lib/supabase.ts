import { createClient, type SupabaseClient } from '@supabase/supabase-js'

const SUPABASE_URL =
  process.env.NEXT_PUBLIC_SUPABASE_URL ||
  (() => {
    throw new Error('Missing NEXT_PUBLIC_SUPABASE_URL environment variable')
  })()

const SUPABASE_ANON_KEY =
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ||
  (() => {
    throw new Error('Missing NEXT_PUBLIC_SUPABASE_ANON_KEY environment variable')
  })()

export const supabase: SupabaseClient = createClient(SUPABASE_URL, SUPABASE_ANON_KEY)
