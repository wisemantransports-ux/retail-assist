import * as fs from 'fs'
import * as path from 'path'
import { createAdminSupabaseClient } from '../app/lib/supabase/server.ts'

// Safe, idempotent admin/demo user provisioning script
// Usage:
//   ts-node scripts/create-admin-users.ts [--file path/to/users.json]
// Or edit the `DEFAULT_USERS` below with desired accounts.

const OUT_DIR = path.join(process.cwd(), 'tmp')
const NOTES_FILE = path.join(OUT_DIR, 'admin-users-notes.txt')

const DEFAULT_USERS = [
  // Example minimal admin user. Provide `password` to set exact password, otherwise a random temp password is generated.
  { email: process.env.ADMIN_EMAIL || 'admin@example.com', password: process.env.ADMIN_PASSWORD || undefined, role: 'super_admin', business_name: 'Acme Corp', createWorkspace: true },
  // Demo user (optional)
  { email: process.env.DEMO_EMAIL || 'demo@example.com', password: process.env.DEMO_PASSWORD || undefined, role: 'user', business_name: 'Demo Co', createWorkspace: false }
]

function ensureOutDir() {
  if (!fs.existsSync(OUT_DIR)) fs.mkdirSync(OUT_DIR, { recursive: true })
}

function randomPassword() {
  return crypto.randomUUID().slice(0, 18) + 'A1!'
}

async function readInputList(): Promise<any[]> {
  const argv = process.argv.slice(2)
  const fileIndex = argv.findIndex(a => a === '--file')
  if (fileIndex !== -1 && argv[fileIndex + 1]) {
    const p = argv[fileIndex + 1]
    if (!fs.existsSync(p)) throw new Error(`Input file not found: ${p}`)
    const raw = JSON.parse(fs.readFileSync(p, 'utf-8'))
    if (!Array.isArray(raw)) throw new Error('Input JSON must be an array of user objects')
    return raw
  }
  return DEFAULT_USERS
}

async function findAuthUserByEmail(supabase: any, email: string) {
  // Use Supabase Admin API to list users and find by email (auth.users is not queryable via .from())
  try {
    const res = await (supabase.auth as any).admin.listUsers({ query: email })
    if (res.error) throw res.error
    // Supabase returns data.users in v2
    const users = res.data?.users || res.data || []
    const found = (users as any[]).find(u => (u.email || '').toLowerCase() === email.toLowerCase())
    return found || null
  } catch (err) {
    throw err
  }
}

async function ensureAuthUser(supabase: any, email: string, password?: string) {
  const existing = await findAuthUserByEmail(supabase, email)
  if (existing) return { id: existing.id, created: false }

  const pw = password || randomPassword()
  // Create auth user using the Supabase Admin API
  let created: any = null
  try {
    const res = await (supabase.auth as any).admin.createUser({ email, password: pw, email_confirm: true })
    created = res.user || res.data?.user || null
  } catch (e: any) {
    // If creation fails because the user already exists, attempt to find and return that user
    try {
      const found = await findAuthUserByEmail(supabase, email)
      if (found) return { id: found.id, created: false }
    } catch (_) {
      // ignore and fall through to rethrow
    }
    throw new Error(`Failed to create auth user for ${email}: ${e?.message || e}`)
  }

  if (!created) throw new Error(`Auth creation returned no user for ${email}`)
  return { id: created.id, created: true, password: pw }
}

async function updateAuthUserPassword(supabase: any, email: string, password: string) {
  const existing = await findAuthUserByEmail(supabase, email)
  if (!existing) throw new Error(`User not found for ${email}`)
  try {
    const res = await (supabase.auth as any).admin.updateUser({ uid: existing.id, password })
    // Some versions use `updateUserById` or return `user` directly
    const updated = res.user || res.data?.user || res.data || null
    if (!updated) throw new Error(`Auth password update returned no user for ${email}`)
    return { id: existing.id }
  } catch (e: any) {
    // Try alternate API shape
    try {
      const r2 = await (supabase.auth as any).admin.updateUserById(existing.id, { password })
      const updated2 = r2.user || r2.data?.user || r2.data || null
      if (!updated2) throw new Error(`Auth password update returned no user for ${email}`)
      return { id: existing.id }
    } catch (e2: any) {
      throw new Error(`Failed to update password for ${email}: ${e?.message || e2?.message || e2}`)
    }
  }
}

async function ensureProfileRow(supabase: any, authUserId: string, data: any) {
  // Check by id (preferred) or by email as fallback
  const { data: existingById } = await supabase.from('users').select('id').eq('id', authUserId).maybeSingle()
  if (existingById) return { created: false }

  const payload: any = {
    id: authUserId,
    email: data.email,
    full_name: data.full_name || null,
    business_name: data.business_name || null,
    subscription_tier: data.subscription_tier || 'starter',
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  }

  const { error } = await supabase.from('users').insert(payload)
  if (error) throw new Error(`Failed to insert users row for ${data.email}: ${error.message}`)
  return { created: true }
}

async function ensureWorkspaceForUser(supabase: any, userId: string, createWorkspace: boolean) {
  // If user already has a workspace membership, skip
  const { data: memberships } = await supabase.from('workspace_members').select('workspace_id').eq('user_id', userId).limit(1)
  if (memberships && memberships.length > 0) return { created: false }

  if (!createWorkspace) return { created: false }

  // Create a workspace and add membership
  const { data: workspace, error: werr } = await supabase.from('workspaces').insert([{
    owner_id: userId,
    name: `Workspace for ${userId.slice(0, 8)}`,
    plan_type: 'starter',
    subscription_status: 'pending',
    payment_status: 'unpaid',
  }]).select().maybeSingle()

  if (werr) throw new Error(`Failed to create workspace for ${userId}: ${werr.message}`)

  const { error: memberErr } = await supabase.from('workspace_members').insert([{
    workspace_id: workspace.id,
    user_id: userId,
    role: 'admin',
  }])
  if (memberErr) throw new Error(`Failed to add workspace member for ${userId}: ${memberErr.message}`)
  return { created: true, workspaceId: workspace.id }
}

async function main() {
  ensureOutDir()

  const users = await readInputList()
  const supabase = createAdminSupabaseClient()

  if (!process.env.SUPABASE_SERVICE_ROLE_KEY) {
    console.error('Missing SUPABASE_SERVICE_ROLE_KEY in environment. Aborting.')
    process.exit(1)
  }

  const notes: string[] = []

  for (const u of users) {
    const email = u.email
    if (!email) continue

    try {
      const authResult = await ensureAuthUser(supabase, email, u.password)
      const userId = authResult.id

      // record password if newly created
      if (authResult.created && authResult.password) {
        notes.push(`Created auth user: ${email} (id: ${userId}) - temporary password: ${authResult.password}`)
      } else {
        notes.push(`Auth user exists: ${email} (id: ${userId})`)
        // If a password was provided and user already existed, ensure it's updated to the provided password
        if (u.password) {
          try {
            await updateAuthUserPassword(supabase, email, u.password)
            notes.push(`Updated auth password for existing user: ${email}`)
          } catch (pwErr: any) {
            notes.push(`Failed to update password for ${email}: ${pwErr?.message || pwErr}`)
            console.error(`Failed to update password for ${email}:`, pwErr)
          }
        }
      }

      // Ensure profile row exists
      await ensureProfileRow(supabase, userId, u)

      // Optionally create a workspace and membership
      if (u.createWorkspace) {
        const ws = await ensureWorkspaceForUser(supabase, userId, true)
        if (ws.created) notes.push(`Created workspace for ${email}: ${ws.workspaceId}`)
      }

      console.log(`OK: ${email} -> ${userId}`)
    } catch (e: any) {
      console.error(`ERROR: ${email} - ${e?.message || e}`)
      notes.push(`ERROR: ${email} - ${e?.message || e}`)
    }
  }

  if (notes.length > 0) fs.writeFileSync(NOTES_FILE, notes.join('\n') + '\n', { flag: 'a' })
  console.log(`Finished. Notes written to ${NOTES_FILE}`)
}

main().catch((err) => {
  console.error('Script failed:', err)
  process.exit(1)
})
