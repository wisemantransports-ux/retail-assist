import { createServerSupabaseClient } from './server';

export async function createMockAdminSupabaseClient(): Promise<any> {
  return createServerSupabaseClient();
}
