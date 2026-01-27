import { createAdminSupabaseClient } from './scripts/lib/admin-client.ts';
import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });

const admin = createAdminSupabaseClient();

// Check the super admin in auth.users
const { data: authUsers, error: authError } = await admin.auth.admin.listUsers();
const superAdmin = authUsers?.users?.find(u => u.email === 'samuelhelp80@gmail.com');

if (superAdmin) {
  console.log('✓ Super admin in auth.users:');
  console.log(`  ID: ${superAdmin.id}`);
  console.log(`  Email: ${superAdmin.email}`);
} else {
  console.log('✗ Super admin not found in auth.users');
}

// Check the super admin in users table
const { data: internalUsers, error: internalError } = await admin
  .from('users')
  .select('id, email, auth_uid, role, workspace_id')
  .eq('email', 'samuelhelp80@gmail.com');

if (internalUsers && internalUsers.length > 0) {
  console.log('\n✓ Super admin in users table:');
  internalUsers.forEach(u => {
    console.log(`  ID: ${u.id}`);
    console.log(`  Email: ${u.email}`);
    console.log(`  Auth UID: ${u.auth_uid}`);
    console.log(`  Role: ${u.role}`);
    console.log(`  Workspace ID: ${u.workspace_id}`);
  });
  
  // Check if auth_uid matches
  if (superAdmin && internalUsers[0].auth_uid !== superAdmin.id) {
    console.log('\n⚠️  MISMATCH: auth_uid in users table does NOT match auth.users.id');
    console.log(`  Expected: ${superAdmin.id}`);
    console.log(`  Got: ${internalUsers[0].auth_uid}`);
  }
} else {
  console.log('✗ Super admin not found in users table');
}
