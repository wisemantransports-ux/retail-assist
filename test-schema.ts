import { createAdminSupabaseClient } from './scripts/lib/admin-client.ts';
import * as dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });
const admin = createAdminSupabaseClient();

// Get one existing user to see what fields exist
const { data, error } = await admin
  .from('users')
  .select('*')
  .limit(1)
  .single();

if (error) {
  console.log('Error:', error);
} else {
  console.log('Sample user record:');
  console.log(JSON.stringify(data, null, 2));
  console.log('\nAvailable columns:', Object.keys(data || {}));
}
