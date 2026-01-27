import { createAdminSupabaseClient } from './scripts/lib/admin-client.ts';
import * as dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });

const admin = createAdminSupabaseClient();

const testEmail = `test-newuser-${Date.now()}@retail-assist.test`;
console.log(`\nAttempting to create user with email: ${testEmail}\n`);

// Test 1: Try without password
console.log('Test 1: Creating user WITHOUT password...');
try {
  const { data, error } = await admin.auth.admin.createUser({
    email: testEmail,
    email_confirm: true,
  });
  
  if (error) {
    console.log('❌ Error:', error);
  } else {
    console.log('✅ Success! User ID:', data.user?.id);
  }
} catch (err) {
  console.log('❌ Exception:', err);
}

// Test 2: Try with a simple password
console.log('\nTest 2: Creating user WITH simple password...');
const testEmail2 = `test-newuser2-${Date.now()}@retail-assist.test`;
try {
  const { data, error } = await admin.auth.admin.createUser({
    email: testEmail2,
    password: 'TestPassword123!',
    email_confirm: true,
  });
  
  if (error) {
    console.log('❌ Error:', error);
  } else {
    console.log('✅ Success! User ID:', data.user?.id);
  }
} catch (err) {
  console.log('❌ Exception:', err);
}
