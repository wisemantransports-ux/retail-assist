import { createAdminSupabaseClient } from './scripts/lib/admin-client.ts';
import * as dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });

const admin = createAdminSupabaseClient();

const superAdminAuthId = '2f188791-47ac-43e0-b5f5-eae63fcb90f2';
const superAdminEmail = 'samuelhelp80@gmail.com';
const workspaceId = 'a322edc8-c0df-438d-92a4-3d722c236bc7';

console.log('Creating user entry linked to existing workspace...\n');

const { data, error } = await admin
  .from('users')
  .insert({
    auth_uid: superAdminAuthId,
    email: superAdminEmail,
    full_name: 'Samuel Help Admin',
    role: 'super_admin',
    workspace_id: workspaceId,
  })
  .select();

if (error) {
  console.log('❌ Error:', error.message);
} else {
  console.log('✅ Successfully created super admin user:');
  console.log(JSON.stringify(data, null, 2));
}
