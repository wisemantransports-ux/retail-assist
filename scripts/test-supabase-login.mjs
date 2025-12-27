import { createClient } from '@supabase/supabase-js'

const url = process.env.NEXT_PUBLIC_SUPABASE_URL
const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

if (!url || !anonKey) {
  console.error('Missing NEXT_PUBLIC_SUPABASE_URL or NEXT_PUBLIC_SUPABASE_ANON_KEY')
  process.exit(1)
}

const supabase = createClient(url, anonKey)

const email = 'admin@demo.com'
const password = '123456'

async function run() {
  try {
    const res = await supabase.auth.signInWithPassword({ email, password })
    console.log('Sign-in response:')
    console.log(JSON.stringify(res, null, 2))
    if (res.error) process.exitCode = 2
  } catch (err) {
    console.error('Unexpected error:', err)
    process.exitCode = 3
  }
}

run()
