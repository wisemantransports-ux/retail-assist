import { createServerClient } from './server';

export async function createAdminSupabaseClient(): Promise<any> {
  return createServerClient();
}
