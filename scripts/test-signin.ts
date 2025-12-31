import { createServerClient } from '../app/lib/supabase/server.ts'

async function main() {
  const supabase = createServerClient()
  const email = process.env.TEST_EMAIL || 'admin@demo.com'
  const password = process.env.TEST_PASSWORD || '123456'

  console.log('Attempting sign in for', email)
  const res = await supabase.auth.signInWithPassword({ email, password })
  console.log('Result:', JSON.stringify({ data: res.data, error: res.error }, null, 2))
}

main().catch(err => { console.error(err); process.exit(1) })
