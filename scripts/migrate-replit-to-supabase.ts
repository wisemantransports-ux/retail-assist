import * as fs from 'fs'
import * as path from 'path'
import { createAdminSupabaseClient } from '@/lib/supabase/server'

/**
 * Migration script: Replit JSON -> Supabase
 *
 * Modes:
 *  - generate-only (default): read .data database + sessions and write export files to ./tmp/migration-output
 *  - run (--run): requires SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY to be set; will create Supabase auth users (random pw) and insert rows into `users` table
 *
 * Note: This script intentionally keeps "run" conservative: it will only create Auth users and insert rows into `users` table.
 * Tokens, business_settings and logs are exported as files for manual review / targeted import.
 */

const DATA_DIR = process.env.DATA_DIR || './.data'
const DB_PATH = path.join(DATA_DIR, 'database.json')
const SESSIONS_PATH = path.join(DATA_DIR, 'sessions.json')
const OUT_DIR = path.join(process.cwd(), 'tmp', 'migration-output')

function ensureOutDir() {
  if (!fs.existsSync(OUT_DIR)) fs.mkdirSync(OUT_DIR, { recursive: true })
}

function readJsonSafe(p: string) {
  if (!fs.existsSync(p)) return null
  try {
    return JSON.parse(fs.readFileSync(p, 'utf-8'))
  } catch (e) {
    console.error('Failed to parse', p, e)
    return null
  }
}

function randomPassword() {
  return crypto.randomUUID().slice(0, 18) + 'A1!'
}

async function generateExports() {
  ensureOutDir()
  const db = readJsonSafe(DB_PATH)
  const sessions = readJsonSafe(SESSIONS_PATH)

  if (!db) {
    console.warn('No database.json found at', DB_PATH)
    return
  }

  // export users, tokens, settings, logs, sessions
  fs.writeFileSync(path.join(OUT_DIR, 'users.json'), JSON.stringify(db.users || {}, null, 2))
  fs.writeFileSync(path.join(OUT_DIR, 'tokens.json'), JSON.stringify(db.tokens || {}, null, 2))
  fs.writeFileSync(path.join(OUT_DIR, 'business_settings.json'), JSON.stringify(db.business_settings || {}, null, 2))
  fs.writeFileSync(path.join(OUT_DIR, 'logs.json'), JSON.stringify(db.logs || [], null, 2))
  if (sessions) fs.writeFileSync(path.join(OUT_DIR, 'sessions.json'), JSON.stringify(sessions, null, 2))

  console.log('Exported Replit DB to', OUT_DIR)
  console.log('Files created: users.json, tokens.json, business_settings.json, logs.json' + (sessions ? ', sessions.json' : ''))
  console.log('\nNext steps:')
  console.log('- Review the exported files in tmp/migration-output before running live migration')
  console.log('- To perform a safe run that creates Supabase Auth users and inserts `users` rows, re-run with SUPABASE env vars set and --run flag')
}

async function runMigration() {
  // require supabase config
  const supabaseUrl = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!supabaseUrl || !serviceKey) {
    throw new Error('Missing SUPABASE_URL and/or SUPABASE_SERVICE_ROLE_KEY in environment. Aborting live run.')
  }

  ensureOutDir()
  const db = readJsonSafe(DB_PATH)
  if (!db) throw new Error('No database.json found; aborting')

  const supabase = createAdminSupabaseClient()

  const users: Record<string, any> = db.users || {}
  const sessions: Record<string, any> = readJsonSafe(SESSIONS_PATH) || {}

  const report: any = { createdAuthUsers: [], insertedUsers: [], skipped: [] }

  // iterate users
  for (const [id, user] of Object.entries(users)) {
    try {
      const email = (user as any).email
      if (!email) {
        report.skipped.push({ id, reason: 'no email' })
        continue
      }

      // Create Supabase Auth user with random password
      const tempPw = randomPassword()

      // Note: uses admin method available with service role key
      // supabase-js v2 admin API: auth.admin.createUser
      let created: any = null
      try {
        const res = await (supabase.auth as any).admin.createUser({ email, password: tempPw, email_confirm: true })
        created = res.user || res.data?.user || null
      } catch (e: any) {
        console.warn('admin.createUser failed for', email, e?.message || e)
      }

      if (!created) {
        // fallback: try create user via signUp (less ideal)
        try {
          const res2 = await supabase.auth.signUp({ email, password: tempPw })
          created = res2.data?.user || null
        } catch (e) {
          console.error('Failed to create auth user for', email)
          report.skipped.push({ id, email, reason: 'createAuthFailed' })
          continue
        }
      }

      const userId = created?.id || crypto.randomUUID()

      // insert into `users` table with id equal to auth user id
      const insertPayload: any = {
        id: userId,
        email: user.email || null,
        full_name: (user as any).full_name || null,
        business_name: (user as any).business_name || null,
        avatar_url: (user as any).avatar_url || null,
        country: (user as any).country || null,
        time_zone: (user as any).time_zone || 'UTC',
        subscription_tier: ((user as any).plan_type as any) || (user as any).package || 'starter',
        created_at: (user as any).created_at || new Date().toISOString(),
        updated_at: (user as any).updated_at || new Date().toISOString(),
      }

      const { error: insertErr } = await supabase.from('users').insert(insertPayload)
      if (insertErr) {
        console.error('Failed to insert user row for', email, insertErr.message)
        report.skipped.push({ id, email, reason: 'insertFailed', details: insertErr.message })
        continue
      }

      report.createdAuthUsers.push({ email, tempPw, userId })
      report.insertedUsers.push({ email, userId })

      // write per-user note for password reset
      fs.appendFileSync(path.join(OUT_DIR, 'admin-notes.txt'), `Created auth user: ${email} (id: ${userId}) - temporary password: ${tempPw}\n`)

      console.log('Created user:', email)
    } catch (e: any) {
      console.error('User migration error for', id, e.message || e)
    }
  }

  // sessions: try insert if `sessions` table exists
  try {
    const sessRows: any[] = []
    for (const [id, session] of Object.entries(sessions)) {
      sessRows.push({ id, ...session })
    }
    if (sessRows.length > 0) {
      const { error } = await supabase.from('sessions').insert(sessRows)
      if (error) {
        console.warn('Failed to insert sessions:', error.message)
        fs.writeFileSync(path.join(OUT_DIR, 'sessions.json'), JSON.stringify(sessions, null, 2))
      } else {
        console.log('Inserted sessions rows (count=', sessRows.length, ')')
      }
    }
  } catch (e) {
    console.warn('Sessions insert encountered an error; exported to tmp/migration-output/sessions.json')
    fs.writeFileSync(path.join(OUT_DIR, 'sessions.json'), JSON.stringify(sessions, null, 2))
  }

  // tokens, business_settings, logs: export for manual import
  fs.writeFileSync(path.join(OUT_DIR, 'tokens.json'), JSON.stringify(db.tokens || {}, null, 2))
  fs.writeFileSync(path.join(OUT_DIR, 'business_settings.json'), JSON.stringify(db.business_settings || {}, null, 2))
  fs.writeFileSync(path.join(OUT_DIR, 'logs.json'), JSON.stringify(db.logs || [], null, 2))

  fs.writeFileSync(path.join(OUT_DIR, 'migration-report.json'), JSON.stringify(report, null, 2))
  console.log('Migration finished. Report at tmp/migration-output/migration-report.json')
  console.log('IMPORTANT: Temporary passwords were written to tmp/migration-output/admin-notes.txt — rotate/reset these passwords and notify users as needed.')
}

async function main() {
  const args = process.argv.slice(2)
  const run = args.includes('--run')

  if (!run) {
    await generateExports()
    console.log('\nTo perform live migration against Supabase, set SUPABASE env vars and run with --run')
    return
  }

  console.log('Running live migration (慎重に)')
  await runMigration()
}

main().catch((err) => {
  console.error('Migration failed:', err)
  process.exit(1)
})
