/**
 * DEPRECATED: Use createBrowserSupabaseClient from @/lib/supabase/client instead.
 *
 * This file is kept for backwards compatibility only.
 * It re-exports the singleton instance from the correct location.
 *
 * This calls createBrowserSupabaseClient() at module load time to ensure
 * the client is initialized before any code uses it.
 */
import { createBrowserSupabaseClient } from '@/lib/supabase/client'
import type { SupabaseClient } from '@supabase/supabase-js'

// Initialize singleton at module load (prevents "Multiple GoTrueClient" issues)
console.log('[Supabase Compat] Initializing singleton at module load');
export const supabase: SupabaseClient = createBrowserSupabaseClient()
console.log('[Supabase Compat] Singleton exported successfully');
