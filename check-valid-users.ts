import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });

const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;

if (!serviceRoleKey || !supabaseUrl) {
  console.error('Missing env vars');
  process.exit(1);
}

const admin = createClient(supabaseUrl, serviceRoleKey);

async function checkUsers() {
  // Get all auth users
  const { data: authData, error: authError } = await admin.auth.admin.listUsers();
  if (authError) {
    console.error('Auth error:', authError);
    return;
  }
  
  const authUsers = authData?.users || [];
  console.log(`Found ${authUsers.length} auth users\n`);
  
  // Get all database users
  const { data: dbUsers, error: dbError } = await admin
    .from('users')
    .select('id, email, auth_uid, role, workspace_id');
  
  if (dbError) {
    console.error('DB error:', dbError);
    return;
  }
  
  // Find matches
  const authUserIds = new Set(authUsers.map(u => u.id));
  
  console.log('Database users with VALID auth_uid:');
  console.log('─'.repeat(70));
  dbUsers?.forEach(dbUser => {
    const authExists = authUserIds.has(dbUser.auth_uid);
    const status = authExists ? '✓ EXISTS' : '✗ MISSING';
    console.log(`${status} | ${dbUser.email} | auth_uid: ${dbUser.auth_uid.substring(0, 8)}... | role: ${dbUser.role}`);
  });
}

checkUsers();
