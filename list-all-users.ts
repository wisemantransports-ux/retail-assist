import { createAdminSupabaseClient } from './scripts/lib/admin-client.ts';
import * as dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });

const admin = createAdminSupabaseClient();

// Find all super_admin users
const { data: superAdmins, error } = await admin
  .from('users')
  .select('id, email, auth_uid, role, workspace_id')
  .eq('role', 'super_admin');

if (error) {
  console.log('Error querying super_admin users:', error);
} else if (superAdmins && superAdmins.length > 0) {
  console.log(`✓ Found ${superAdmins.length} super_admin user(s):`);
  superAdmins.forEach(u => {
    console.log(`\n  Email: ${u.email}`);
    console.log(`  ID: ${u.id}`);
    console.log(`  Auth UID: ${u.auth_uid}`);
    console.log(`  Workspace ID: ${u.workspace_id}`);
  });
} else {
  console.log('✗ No super_admin users found');
}

// Also list all users to see what we have
console.log('\n\n📋 All users in the database:');
const { data: allUsers, error: allError } = await admin
  .from('users')
  .select('id, email, role, workspace_id')
  .order('email');

if (allError) {
  console.log('Error:', allError);
} else {
  allUsers?.forEach(u => {
    console.log(`  ${u.email} - ${u.role} (workspace: ${u.workspace_id || 'null'})`);
  });
}
