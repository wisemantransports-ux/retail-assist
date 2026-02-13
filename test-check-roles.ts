import { createAdminSupabaseClient } from './scripts/lib/admin-client.ts';
import * as dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });
const admin = createAdminSupabaseClient();

// Check for super_admin role
console.log('Checking for super_admin users...\n');
const { data: superAdmins, error } = await admin
  .from('users')
  .select('id, email, role, workspace_id, auth_uid')
  .eq('role', 'super_admin');

if (error) {
  console.log('Error:', error);
} else {
  console.log(`Found ${superAdmins?.length || 0} super_admin users:`);
  superAdmins?.forEach(u => {
    console.log(`  - ${u.email} | workspace: ${u.workspace_id} | auth_uid: ${u.auth_uid}`);
  });
}

// Also check for admin role
console.log('\n\nChecking for admin users...\n');
const { data: clientAdmins } = await admin
  .from('users')
  .select('id, email, role, workspace_id')
  .eq('role', 'admin')
  .limit(5);

console.log(`Found ${clientAdmins?.length || 0} admin users:`);
clientAdmins?.forEach(u => {
  console.log(`  - ${u.email} | workspace: ${u.workspace_id}`);
});
