/**
 * Standalone Supabase Admin Client for CLI Scripts
 * Avoids Next.js dependencies
 */

import { createClient, SupabaseClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';

// Load env if not already loaded
dotenv.config({ path: '.env.local' });

export function createAdminSupabaseClient(): SupabaseClient {
  const url = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url || !serviceRoleKey) {
    throw new Error(
      `Supabase configuration missing:\n` +
      `  SUPABASE_URL: ${url ? '✓' : '✗'}\n` +
      `  SUPABASE_SERVICE_ROLE_KEY: ${serviceRoleKey ? '✓' : '✗'}\n` +
      `Check your .env.local file`
    );
  }

  return createClient(url, serviceRoleKey);
}
