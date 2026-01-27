import { createAdminSupabaseClient } from './scripts/lib/admin-client.ts';
import * as dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });

const admin = createAdminSupabaseClient();
const superAdminAuthId = '2f188791-47ac-43e0-b5f5-eae63fcb90f2';

// Check if user exists by auth_uid
const { data: byAuthId, error: err1 } = await admin
  .from('users')
  .select('*')
  .eq('auth_uid', superAdminAuthId);

console.log('Users with auth_uid', superAdminAuthId);
if (err1) {
  console.log('Error:', err1.message);
} else {
  console.log('Count:', byAuthId?.length);
  byAuthId?.forEach(u => console.log({ id: u.id, email: u.email, role: u.role }));
}

// Also check by email
console.log('\nUsers with email samuelhelp80@gmail.com');
const { data: byEmail, error: err2 } = await admin
  .from('users')
  .select('*')
  .eq('email', 'samuelhelp80@gmail.com');

if (err2) {
  console.log('Error:', err2.message);
} else {
  console.log('Count:', byEmail?.length);
  byEmail?.forEach(u => console.log({ id: u.id, auth_uid: u.auth_uid, role: u.role }));
}
