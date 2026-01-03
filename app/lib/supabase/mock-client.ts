import { createServerClient } from './server';

export async function createAdminSupabaseClient(): Promise<any> {
  return createServerClient();
}

// Backwards-compatible alias
export async function createMockAdminSupabaseClient(): Promise<any> {
  return createAdminSupabaseClient();
}
