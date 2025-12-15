import { createServerSupabaseClient } from './server';

export async function createAdminSupabaseClient(): Promise<any> {
  return createServerSupabaseClient();
}
