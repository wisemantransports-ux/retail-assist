import { createAdminSupabaseClient } from './scripts/lib/admin-client.ts';
import * as dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });

const admin = createAdminSupabaseClient();

// Get all users from auth.users
const { data: authUsers } = await admin.auth.admin.listUsers();

console.log(`✓ Found ${authUsers?.users?.length || 0} users in auth.users:\n`);

if (authUsers?.users) {
  // Check which auth users exist in the users table and have super_admin role
  const authUsersWithEmails = authUsers.users.filter(u => u.email && u.email.length > 0);
  console.log('Auth users with email addresses:');
  
  for (const authUser of authUsersWithEmails.slice(0, 5)) {
    const { data: internalUser } = await admin
      .from('users')
      .select('id, email, role, auth_uid')
      .eq('auth_uid', authUser.id)
      .single();
    
    const status = internalUser ? `✓ in users table (role: ${internalUser.role})` : '✗ NOT in users table';
    console.log(`  ${authUser.email} - ${status}`);
  }
}
