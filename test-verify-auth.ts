import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });

const client = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL || '',
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || ''
);

console.log('Testing authentication with samuelhelp80@gmail.com...\n');

const { data, error } = await client.auth.signInWithPassword({
  email: 'samuelhelp80@gmail.com',
  password: '123456',
});

if (error) {
  console.log('❌ Authentication failed:', error.message);
} else if (!data.user) {
  console.log('❌ No user returned');
} else {
  console.log('✅ Authentication successful!');
  console.log(`   User ID: ${data.user.id}`);
  console.log(`   Email: ${data.user.email}`);
  console.log(`   Session: ${data.session ? 'YES' : 'NO'}`);
  
  // Try to get the user from auth to verify it works
  const { data: checkUser, error: checkError } = await client.auth.getUser(data.session?.access_token);
  
  if (checkError) {
    console.log(`\n❌ Error verifying user:`, checkError.message);
  } else {
    console.log(`\n✅ User verification passed`);
    console.log(`   Verified ID: ${checkUser.user?.id}`);
  }
}
