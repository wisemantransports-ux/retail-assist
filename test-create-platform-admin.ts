import { createAdminSupabaseClient } from './scripts/lib/admin-client.ts';
import * as dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });

const admin = createAdminSupabaseClient();

const superAdminAuthId = '2f188791-47ac-43e0-b5f5-eae63fcb90f2';
const superAdminEmail = 'samuelhelp80@gmail.com';

console.log('Creating platform-level super admin user (workspace_id = null)...\n');

const { data, error } = await admin
  .from('users')
  .insert({
    auth_uid: superAdminAuthId,
    email: superAdminEmail,
    full_name: 'Samuel Help Admin',
    role: 'super_admin',
    workspace_id: null,
  })
  .select();

if (error) {
  console.log('❌ Error:', error.message);
  console.log('Details:', error.details);
  
  // If duplicate constraint, try updating instead
  if (error.message.includes('duplicate')) {
    console.log('\nTrying UPDATE instead...');
    const { data: updated, error: updateError } = await admin
      .from('users')
      .update({
        auth_uid: superAdminAuthId,
        email: superAdminEmail,
        full_name: 'Samuel Help Admin',
        role: 'super_admin',
      })
      .eq('auth_uid', superAdminAuthId)
      .select();
    
    if (updateError) {
      console.log('❌ Update failed:', updateError.message);
    } else {
      console.log('✅ Updated:');
      console.log(JSON.stringify(updated, null, 2));
    }
  }
} else {
  console.log('✅ Successfully created super admin user:');
  console.log(JSON.stringify(data, null, 2));
}
