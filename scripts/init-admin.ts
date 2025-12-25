import { createAdminSupabaseClient } from '@/lib/supabase/server'

async function initAdmin() {
  const adminEmail = process.env.ADMIN_EMAIL || 'admin@example.com'
  const adminPassword = process.env.ADMIN_PASSWORD || 'admin123'

  console.log('Initializing admin user in Supabase...')

  const supabase = createAdminSupabaseClient()

  // Look for existing admin by email or role
  const { data: existingUsers, error: fetchErr } = await supabase.from('users').select('*').eq('email', adminEmail)
  if (fetchErr) {
    console.error('Failed to query users:', fetchErr.message)
    throw fetchErr
  }

  if (existingUsers && existingUsers.length > 0) {
    console.log('Admin user already exists:', adminEmail)
    console.log('NOTE: Passwords are managed by Supabase Auth. To change password, use the Supabase dashboard or CLI.')
    return
  }

  // Insert minimal admin record into users table. Note: create a Supabase auth user separately if required.
  const now = new Date().toISOString()
  const id = crypto.randomUUID()

  const payload = {
    id,
    email: adminEmail,
    business_name: 'Admin',
    phone: '',
    plan_id: 'enterprise',
    subscription_tier: 'enterprise',
    role: 'admin',
    created_at: now,
    updated_at: now
  }

  const { error } = await supabase.from('users').insert(payload)
  if (error) {
    console.error('Failed to create admin user in Supabase:', error.message)
    throw error
  }

  console.log('Admin user record created in Supabase users table: ', adminEmail)
  console.log('IMPORTANT: Create a Supabase Auth user for this email (via Dashboard or CLI) and set its password.')
}

initAdmin().catch(console.error)
