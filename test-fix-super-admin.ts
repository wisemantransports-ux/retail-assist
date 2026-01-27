import { createAdminSupabaseClient } from './scripts/lib/admin-client.ts';
import * as dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });

const admin = createAdminSupabaseClient();

// Find the super admin user by email in auth.users
console.log('Checking samuelhelp80@gmail.com in auth.users...\n');

const { data: authUsers, error: authError } = await admin.auth.admin.listUsers();

if (authError) {
  console.log('Error fetching auth users:', authError.message);
} else {
  const superAdminAuth = authUsers.users.find(u => u.email === 'samuelhelp80@gmail.com');
  
  if (!superAdminAuth) {
    console.log('❌ No auth user found with email: samuelhelp80@gmail.com');
  } else {
    console.log('✅ Found in auth.users:');
    console.log(`   ID (auth_uid): ${superAdminAuth.id}`);
    console.log(`   Email: ${superAdminAuth.email}`);
    
    // Now check the users table
    const { data: internalUsers, error: internalError } = await admin
      .from('users')
      .select('*')
      .eq('auth_uid', superAdminAuth.id);
    
    if (internalError) {
      console.log(`\n❌ Error checking users table:`, internalError.message);
    } else if (!internalUsers || internalUsers.length === 0) {
      console.log(`\n❌ NO entry in users table with auth_uid: ${superAdminAuth.id}`);
      console.log('\n✅ Solution: Creating users table entry for super admin...');
      
      // Create the missing users entry
      const { data: created, error: createError } = await admin
        .from('users')
        .insert({
          auth_uid: superAdminAuth.id,
          email: superAdminAuth.email,
          full_name: 'Samuel Help',
          role: 'super_admin',
        })
        .select();
      
      if (createError) {
        console.log(`❌ Failed to create users entry:`, createError.message);
      } else {
        console.log(`✅ Created users table entry:`, created);
      }
    } else {
      console.log(`\n✅ Found in users table:`);
      internalUsers.forEach(u => {
        console.log(`   ID: ${u.id}`);
        console.log(`   Email: ${u.email}`);
        console.log(`   Role: ${u.role}`);
        console.log(`   Workspace: ${u.workspace_id || 'NULL (platform-level)'}`);
      });
    }
  }
}
