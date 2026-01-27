import { createAdminSupabaseClient } from './scripts/lib/admin-client.ts';
import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });

const admin = createAdminSupabaseClient();

// Find joe@demo.com in users table
const { data: joeUser } = await admin
  .from('users')
  .select('id, email, auth_uid, role')
  .eq('email', 'joe@demo.com')
  .single();

if (joeUser) {
  console.log('✓ Found joe@demo.com in users table:');
  console.log(`  ID: ${joeUser.id}`);
  console.log(`  Auth UID: ${joeUser.auth_uid}`);
  console.log(`  Current role: ${joeUser.role}`);
  
  // Update role to super_admin
  const { data: updated, error } = await admin
    .from('users')
    .update({ role: 'super_admin' })
    .eq('id', joeUser.id)
    .select();
  
  if (error) {
    console.log('\n✗ Error updating role:', error);
  } else {
    console.log('\n✓ Updated role to super_admin');
    console.log(`  New role: ${updated?.[0]?.role}`);
  }
} else {
  console.log('✗ joe@demo.com not found');
}
