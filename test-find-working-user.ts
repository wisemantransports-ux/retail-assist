import { createAdminSupabaseClient } from './scripts/lib/admin-client.ts';
import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });

const admin = createAdminSupabaseClient();
const anonClient = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

// Get all users with auth_uid from database
const { data: dbUsers } = await admin
  .from('users')
  .select('email, auth_uid, role')
  .not('auth_uid', 'is', null);

if (!dbUsers || dbUsers.length === 0) {
  console.log('No users found in database');
  process.exit(0);
}

console.log(`Found ${dbUsers.length} users with auth_uid. Testing passwords...\n`);

const passwords = ['123456', 'Test1234!', 'TestPassword123!'];

for (const user of dbUsers) {
  console.log(`Testing ${user.email} (${user.role})...`);
  
  let found = false;
  for (const pwd of passwords) {
    const { data: signInData, error } = await anonClient.auth.signInWithPassword({
      email: user.email,
      password: pwd,
    });

    if (!error && signInData?.session) {
      console.log(`  ✅ PASSWORD WORKS: ${pwd}`);
      console.log(`     Auth UID: ${signInData.user.id}`);
      found = true;
      break;
    }
  }

  if (!found) {
    console.log(`  ❌ None of the tested passwords worked`);
  }
  console.log();
}
