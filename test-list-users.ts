import { createAdminSupabaseClient } from './scripts/lib/admin-client.ts';
import * as dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });
const admin = createAdminSupabaseClient();

// List all auth users
console.log('Checking auth users...\n');
const { data: { users }, error } = await admin.auth.admin.listUsers();

if (error) {
  console.log('Error listing users:', error);
} else {
  console.log(`Found ${users?.length} auth users:`);
  users?.slice(0, 10).forEach(u => {
    console.log(`  - ${u.email} (confirmed: ${u.email_confirmed_at})`);
  });
}

// Now check users table
console.log('\n\nChecking users table...\n');
const { data: dbUsers, error: dbError } = await admin
  .from('users')
  .select('id, email, role, auth_uid')
  .limit(10);

if (dbError) {
  console.log('Error:', dbError);
} else {
  console.log(`Found ${dbUsers?.length} users in table:`);
  dbUsers?.forEach(u => {
    console.log(`  - ${u.email} | role: ${u.role} | auth_uid: ${u.auth_uid}`);
  });
}
