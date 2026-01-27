import { createAdminSupabaseClient } from './scripts/lib/admin-client.ts';
import * as dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });

const admin = createAdminSupabaseClient();

// The user ID from when we authenticated successfully
const superAdminAuthId = '2f188791-47ac-43e0-b5f5-eae63fcb90f2';
const superAdminEmail = 'samuelhelp80@gmail.com';

console.log('Creating users table entry for super admin...\n');

// Check if entry already exists
const { data: existing, error: checkError } = await admin
  .from('users')
  .select('*')
  .eq('auth_uid', superAdminAuthId)
  .maybeSingle();

if (checkError) {
  console.log('❌ Error checking for existing entry:', checkError.message);
} else if (existing) {
  console.log('✅ Entry already exists:');
  console.log(`   ID: ${existing.id}`);
  console.log(`   Email: ${existing.email}`);
  console.log(`   Role: ${existing.role}`);
} else {
  console.log('Creating new entry...');
  
  const { data: created, error: createError } = await admin
    .from('users')
    .insert({
      auth_uid: superAdminAuthId,
      email: superAdminEmail,
      full_name: 'Samuel Help',
      role: 'super_admin',
      workspace_id: null,
    })
    .select();
  
  if (createError) {
    console.log('❌ Failed to create entry:', createError.message);
  } else {
    console.log('✅ Successfully created:');
    console.log(JSON.stringify(created, null, 2));
  }
}
