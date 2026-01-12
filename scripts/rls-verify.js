require('dotenv').config({ path: '.env.local' })
const { createClient } = require('@supabase/supabase-js')

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL
const ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || process.env.SUPABASE_ANON_KEY
const TEST_EMAIL = 'newuser@example.com'
const TEST_PASSWORD = 'strongpassword'

if (!SUPABASE_URL || !ANON_KEY) {
  console.error('Missing SUPABASE_URL or ANON_KEY in .env.local')
  process.exit(1)
}

const supabase = createClient(SUPABASE_URL, ANON_KEY)

async function fail(step, info) {
  console.error(`\nFAILED ${step}:`, info)
  process.exit(2)
}

async function main() {
  console.log('STEP F-2 — Signing in')
  const sign = await supabase.auth.signInWithPassword({ email: TEST_EMAIL, password: TEST_PASSWORD })
  console.log('STEP F-2 SIGNIN', JSON.stringify(sign, null, 2))
  if (sign.error || !sign.data) return await fail('F-2', sign.error || 'No data')

  console.log('\nSTEP F-3 — Session verification')
  const userRes = await supabase.auth.getUser()
  console.log('STEP F-3 AUTH USER', JSON.stringify(userRes, null, 2))
  if (userRes.error) return await fail('F-3', userRes.error)
  if (!userRes.data?.user) return await fail('F-3', 'No user in response')

  console.log('\nSTEP F-4 — Query users table')
  const users = await supabase.from('users').select('id, email, auth_uid')
  console.log('STEP F-4 USERS', JSON.stringify(users, null, 2))
  if (users.error) return await fail('F-4', users.error)

  console.log('\nSTEP F-5 — Query workspaces')
  const ws = await supabase.from('workspaces').select('id, name, owner_id')
  console.log('STEP F-5 WORKSPACES', JSON.stringify(ws, null, 2))
  if (ws.error) return await fail('F-5', ws.error)

  console.log('\nSTEP F-6 — Query workspace_members')
  const members = await supabase.from('workspace_members').select('workspace_id, user_id, role')
  console.log('STEP F-6 MEMBERS', JSON.stringify(members, null, 2))
  if (members.error) return await fail('F-6', members.error)

  console.log('\nSTEP F-7 — Query admin_access')
  const admin = await supabase.from('admin_access').select('workspace_id, user_id, role')
  console.log('STEP F-7 ADMIN ACCESS', JSON.stringify(admin, null, 2))
  if (admin.error) return await fail('F-7', admin.error)

  console.log('\nSTEP F-8 — Negative leakage helper (run with an OTHER workspace id)')
  console.log('To run STEP F-8: node scripts/rls-verify.js <OTHER_WORKSPACE_ID>')
  if (process.argv[2]) {
    const other = process.argv[2]
    const neg = await supabase.from('workspaces').select('*').eq('id', other)
    console.log('STEP F-8 NEGATIVE TEST', JSON.stringify(neg, null, 2))
    if (neg.error) return await fail('F-8', neg.error)
    if (Array.isArray(neg.data) && neg.data.length === 0) {
      console.log('STEP F-8 PASSED — empty array')
    } else {
      console.log('STEP F-8 RESULT — data length', Array.isArray(neg.data) ? neg.data.length : 'non-array')
    }
  }

  console.log('\nAll steps F-2..F-7 completed successfully (check outputs above against expectations).')
}

main().catch(e => { console.error('UNEXPECTED ERROR', e); process.exit(99) })
