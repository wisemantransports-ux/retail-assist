import { createAdminSupabaseClient } from './scripts/lib/admin-client.ts';
import * as dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });
const admin = createAdminSupabaseClient();

// Look for existing super_admin users
const { data: adminUsers, error } = await admin
  .from('users')
  .select('id, email, role')
  .eq('role', 'super_admin');

if (error) {
  console.log('Error:', error);
} else {
  console.log(`Found ${adminUsers?.length || 0} super_admin users:`);
  adminUsers?.forEach(user => {
    console.log(`  - ${user.email} (${user.id})`);
  });
}

// Also check for any admin user
const { data: allAdmins, error: allError } = await admin
  .from('users')
  .select('id, email, role')
  .eq('role', 'admin');

if (!allError && allAdmins && allAdmins.length > 0) {
  console.log(`\nFound ${allAdmins.length} admin users:`);
  allAdmins.forEach(user => {
    console.log(`  - ${user.email} (${user.id})`);
  });
}
