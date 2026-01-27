import { createAdminSupabaseClient } from './scripts/lib/admin-client.ts';
import * as dotenv from 'dotenv';
import { createClient } from '@supabase/supabase-js';

dotenv.config({ path: '.env.local' });

const email = 'samuelhelp80@gmail.com';

// Check if user exists in auth
const anonClient = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL || '',
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || ''
);

const { data: authData, error: authError } = await anonClient.auth.signInWithPassword({
  email,
  password: '123456',
});

if (authError || !authData.user) {
  console.log('❌ Auth login failed:', authError?.message);
} else {
  console.log(`✅ Auth user found:`, { id: authData.user.id, email: authData.user.email });
  
  // Now check if this auth_uid exists in users table
  const admin = createAdminSupabaseClient();
  const { data: internalUser, error } = await admin
    .from('users')
    .select('*')
    .eq('auth_uid', authData.user.id)
    .maybeSingle();
  
  if (error) {
    console.log('❌ Error checking internal user:', error.message);
  } else if (!internalUser) {
    console.log('❌ No internal user found with this auth_uid');
  } else {
    console.log(`✅ Internal user found:`, { id: internalUser.id, role: internalUser.role });
  }
}
