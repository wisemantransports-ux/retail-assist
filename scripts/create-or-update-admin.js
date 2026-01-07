require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');

async function main() {
  const supabaseUrl = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !serviceRoleKey) {
    console.error('Error: SUPABASE_URL (or NEXT_PUBLIC_SUPABASE_URL) and SUPABASE_SERVICE_ROLE_KEY must be set in environment variables.');
    process.exit(1);
  }

  const supabaseAdmin = createClient(supabaseUrl, serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false }
  });

  const email = 'samuelhelp80@gmail.com';
  const password = '123456';
  const role = 'admin';

  try {
    // Check if user exists
    const { data: usersData, error: listError } = await supabaseAdmin.auth.admin.listUsers();
    if (listError) {
      throw new Error(`Failed to list users: ${listError.message}`);
    }
    const users = usersData.users || [];
    const existingUser = users.find(u => u.email.toLowerCase() === email.toLowerCase());

    if (existingUser) {
      // Update existing user
      console.log(`User ${email} exists. Updating password, role, and email verification...`);
      const { error: updateError } = await supabaseAdmin.auth.admin.updateUserById(existingUser.id, {
        password,
        user_metadata: { role },
        email_confirm: true
      });

      if (updateError) {
        throw new Error(`Failed to update user: ${updateError.message}`);
      }

      console.log(`Successfully updated user ${email}.`);
    } else {
      // Create new user
      console.log(`User ${email} does not exist. Creating new admin user...`);
      const { error: createError } = await supabaseAdmin.auth.admin.createUser({
        email,
        password,
        user_metadata: { role },
        email_confirm: true
      });

      if (createError) {
        throw new Error(`Failed to create user: ${createError.message}`);
      }

      console.log(`Successfully created user ${email}.`);
    }
  } catch (error) {
    console.error(`Error: ${error.message}`);
    process.exit(1);
  }
}

main();