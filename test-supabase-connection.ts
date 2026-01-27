import { createAdminSupabaseClient } from './scripts/lib/admin-client.ts';
import * as dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });

const admin = createAdminSupabaseClient();

// Try a simple query to verify the connection works
console.log('🔍 Testing Supabase connection...\n');

const { data, error } = await admin.from('users').select('id').limit(1);
console.log('✓ Connection test (database query):', { 
  success: !error, 
  recordCount: data?.length || 0,
  error: error?.message 
});

// Try listing users (read-only, should work if credentials are valid)
const { data: users, error: usersError } = await admin.auth.admin.listUsers();
console.log('\n✓ Auth admin test (list users):', { 
  success: !usersError, 
  userCount: users?.users?.length || 0,
  error: usersError?.message 
});

// Check Supabase URL and key
console.log('\n✓ Environment variables:');
console.log(`  SUPABASE_URL: ${process.env.SUPABASE_URL ? '✓ SET' : '✗ NOT SET'}`);
console.log(`  SUPABASE_SERVICE_ROLE_KEY: ${process.env.SUPABASE_SERVICE_ROLE_KEY ? '✓ SET' : '✗ NOT SET'}`);
console.log(`  NEXT_PUBLIC_SUPABASE_JWT_SECRET: ${process.env.NEXT_PUBLIC_SUPABASE_JWT_SECRET ? '✓ SET' : '✗ NOT SET'}`);

console.log('\n✅ Supabase connection test complete!');
