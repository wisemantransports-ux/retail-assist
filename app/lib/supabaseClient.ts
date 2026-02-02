/**
 * DEPRECATED: Use createBrowserSupabaseClient from @/lib/supabase/client instead.
 *
 * This file is kept for backwards compatibility only.
 * It re-exports the singleton instance from the correct location.
 */
import { createBrowserSupabaseClient } from '@/lib/supabase/client'
import type { SupabaseClient } from '@supabase/supabase-js'

export function getSupabaseClient(): SupabaseClient {
  return createBrowserSupabaseClient()
}

export default getSupabaseClient

// Backwards-compat: export a `supabase` reference
export const supabase = createBrowserSupabaseClient() as SupabaseClient
