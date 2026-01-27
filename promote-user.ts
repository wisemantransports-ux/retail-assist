import { createAdminSupabaseClient } from './scripts/lib/admin-client.ts';
import * as dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });

const admin = createAdminSupabaseClient();

// Get user with empty email (the first one in the list)
const { data: firstUser, error } = await admin
  .from('users')
  .select('*')
  .eq('email', '')
  .single();

if (error) {
  console.log('Error finding first user:', error);
} else if (firstUser) {
  console.log('✓ Found first user:');
  console.log(JSON.stringify(firstUser, null, 2));
  
  // Update this user to have super_admin role
  const { data: updated, error: updateError } = await admin
    .from('users')
    .update({ role: 'super_admin' })
    .eq('id', firstUser.id)
    .select();
  
  if (updateError) {
    console.log('\n✗ Error updating role:', updateError);
  } else {
    console.log('\n✓ Updated user role to super_admin');
    console.log(JSON.stringify(updated, null, 2));
  }
} else {
  console.log('No first user found');
}
