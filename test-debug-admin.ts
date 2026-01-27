import { createAdminSupabaseClient } from './scripts/lib/admin-client.ts';
import * as dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });

async function testQuery() {
  console.log('Starting query...');
  const admin = createAdminSupabaseClient();
  
  const { data: existing Admins, error: findError } = await admin
    .from('users')
    .select('id, email')
    .eq('role', 'super_admin')
    .limit(1);

  console.log('Query result:', { existingAdmins, error: findError });
}

await testQuery();
