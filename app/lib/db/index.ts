import { createServerClient, createAdminSupabaseClient } from '@/lib/supabase/server'
import { resolveUserId } from '@/lib/supabase/queries'
import { env } from '@/lib/env'

// NOTE: Mock mode is enabled by default while we are preparing to go-live.
// When you're ready to go-live with Supabase:
//  1) Set NEXT_PUBLIC_USE_MOCK_SUPABASE=false in your environment
//  2) Add SUPABASE_URL, NEXT_PUBLIC_SUPABASE_ANON_KEY and SUPABASE_SERVICE_ROLE_KEY
//  3) Run migrations (see supabase/migrations) and optionally run migrate-replit-to-supabase.ts
//  4) Re-run the site and verify production flows (payments, webhooks)
// Until then, DB operations use the local dev seed at tmp/dev-seed/database.json when `env.useMockMode` is true.
const supabase = () => createServerClient()

export const PLAN_LIMITS = {
  starter: {
    name: 'Starter',
    price: 22,
    maxPages: 1,
    hasInstagram: false,
    hasAiResponses: true,
    commentToDmLimit: 100,
    features: ['Facebook Messenger auto-reply', 'Comment-to-DM (100/month)', '1 Facebook Page', 'Basic AI responses']
  },
  pro: {
    name: 'Pro',
    price: 45,
    maxPages: 3,
    hasInstagram: true,
    hasAiResponses: true,
    commentToDmLimit: 500,
    features: ['Facebook + Instagram automation', 'Comment-to-DM (500/month)', '3 Pages/Accounts', 'AI-powered responses']
  },
  enterprise: {
    name: 'Enterprise',
    price: 75,
    maxPages: -1,
    hasInstagram: true,
    hasAiResponses: true,
    commentToDmLimit: -1,
    features: ['All features unlocked', 'Unlimited pages/accounts', 'Priority support', 'Custom automation rules']
  }
}

function generateId() {
  return crypto.randomUUID()
}

function generateSalt() {
  const array = new Uint8Array(16)
  crypto.getRandomValues(array)
  return Array.from(array).map(b => b.toString(16).padStart(2, '0')).join('')
}

async function hashPasswordWithSalt(password: string, salt: string): Promise<string> {
  const encoder = new TextEncoder()
  const data = encoder.encode(password + salt)
  const hashBuffer = await crypto.subtle.digest('SHA-256', data)
  const hashArray = Array.from(new Uint8Array(hashBuffer))
  const hash = hashArray.map(b => b.toString(16).padStart(2, '0')).join('')
  return `${salt}:${hash}`
}

async function verifyPassword(password: string, storedHash: string): Promise<boolean> {
  if (storedHash.includes(':')) {
    const [salt] = storedHash.split(':')
    const newHash = await hashPasswordWithSalt(password, salt)
    return newHash === storedHash
  }
  return false
}

function migrateUser(user: any) {
  if (user.package && !user.plan_type) {
    const packageToPlan: Record<string, 'starter' | 'pro' | 'enterprise'> = {
      'starter': 'starter',
      'professional': 'pro',
      'enterprise': 'enterprise'
    }
    user.plan_type = packageToPlan[user.package] || 'starter'
  }
  if (user.status && !user.subscription_status) {
    const statusMap: Record<string, 'pending' | 'awaiting_approval' | 'active' | 'suspended'> = {
      'pending': 'pending',
      'active': 'active',
      'inactive': 'suspended'
    }
    user.subscription_status = statusMap[user.status] || 'pending'
  }
  if (!user.payment_status) {
    user.payment_status = user.subscription_status === 'active' ? 'paid' : 'unpaid'
  }
  delete user.package
  delete user.status
  return user
}

export const db = {
  users: {
    async create(data: { email: string; password: string; business_name: string; phone: string; plan_type: 'starter' | 'pro' | 'enterprise' }) {
      // This helper performs privileged writes to the `users` table.
      // Use the service-role/admin Supabase client so writes bypass RLS
      // and avoid `permission denied` errors in production.
      const useLocal = env.useMockMode
      if (!useLocal) {
        const s = createAdminSupabaseClient()
        const salt = generateSalt()
        const password_hash = await hashPasswordWithSalt(data.password, salt)
        const now = new Date().toISOString()
        const id = generateId()

        const payload = {
          id,
          email: data.email,
          password_hash,
          business_name: data.business_name,
          phone: data.phone,
          plan_type: data.plan_type,
          payment_status: 'unpaid',
          subscription_status: 'pending',
          role: 'user',
          created_at: now,
          updated_at: now
        }

        const { error } = await s.from('users').insert(payload)
        if (error) {
          console.error('[DB] Error creating user:', error.message)
          throw error
        }

        // create default settings (we use the admin client here as well because
        // this operation runs during user provisioning and may require elevated
        // permissions depending on RLS policies)
        const defaultSettings = {
          id: generateId(),
          user_id: id,
          auto_reply_enabled: true,
          comment_to_dm_enabled: true,
          greeting_message: `Hi! Thanks for reaching out to ${data.business_name}! How can we help you today?`,
          away_message: `Thanks for your message! Our team at ${data.business_name} will get back to you shortly.`,
          keywords: ['price','cost','buy','order','available','stock','deliver','shipping','payment','discount'],
          ai_enabled: true,
          system_prompt: `You are a friendly, professional sales assistant for ${data.business_name}.`,
          created_at: now,
          updated_at: now
        }

        await s.from('business_settings').insert(defaultSettings)

        return { id, ...payload }
      }

      // Local fallback (dev seed stored in tmp/dev-seed/database.json)
      const fs = await import('fs')
      const path = await import('path')
      const P = path.join(process.cwd(), 'tmp', 'dev-seed', 'database.json')
      if (!fs.existsSync(P)) throw new Error('Dev DB not seeded. Run scripts/create-dev-seed.js')
      const dbRaw = JSON.parse(fs.readFileSync(P, 'utf-8'))
      const now = new Date().toISOString()
      const id = generateId()
      const user = {
        id,
        email: data.email,
        password: data.password, // plaintext in dev seed
        business_name: data.business_name,
        phone: data.phone,
        plan_type: data.plan_type,
        payment_status: 'unpaid',
        subscription_status: 'pending',
        role: 'user',
        created_at: now,
        updated_at: now
      }
      dbRaw.users[id] = user
      fs.writeFileSync(P, JSON.stringify(dbRaw, null, 2))
      return user
    },

    async findByEmail(email: string) {
      const useLocal = env.useMockMode
      if (!useLocal) {
        const s = supabase()
        const { data, error } = await s.from('users').select('*').eq('email', email).maybeSingle()
        if (error) throw error
        return data ? migrateUser(data) : null
      }

      const fs = await import('fs')
      const path = await import('path')
      const P = path.join(process.cwd(), 'tmp', 'dev-seed', 'database.json')
      if (!fs.existsSync(P)) return null
      const dbRaw = JSON.parse(fs.readFileSync(P, 'utf-8'))
      const u = Object.values(dbRaw.users || {}).find((x: any) => x.email === email)
      return u ? migrateUser(u) : null
    },

    async findById(id: string) {
      const useLocal = env.useMockMode
      if (!useLocal) {
        const s = supabase()
        const { data, error } = await s.from('users').select('*').eq('id', id).maybeSingle()
        if (error) throw error
        if (data) return migrateUser(data)
        // Fallback: try to find by auth_uid (read-only, do not create)
        const { data: byAuth, error: authErr } = await s.from('users').select('*').eq('auth_uid', id).maybeSingle()
        if (authErr) throw authErr
        return byAuth ? migrateUser(byAuth) : null
      }

      const fs = await import('fs')
      const path = await import('path')
      const P = path.join(process.cwd(), 'tmp', 'dev-seed', 'database.json')
      if (!fs.existsSync(P)) return null
      const dbRaw = JSON.parse(fs.readFileSync(P, 'utf-8'))
      const u = dbRaw.users ? dbRaw.users[id] : null
      return u ? migrateUser(u) : null
    },

    async authenticate(email: string, password: string) {
      const useLocal = env.useMockMode
      const user = await this.findByEmail(email)
      if (!user) return null
      if (useLocal) {
        // dev seed stores plaintext password in `password` field
        if ((user as any).password && (user as any).password === password) return user
        // fall back to password_hash if present
        const valid = await verifyPassword(password, user.password_hash || '')
        return valid ? user : null
      }
      const valid = await verifyPassword(password, user.password_hash)
      return valid ? user : null
    },

    async getAll() {
      const s = supabase()
      const { data, error } = await s.from('users').select('*')
      if (error) throw error
      return data.map(migrateUser)
    },

    async update(id: string, data: any) {
      // This update performs a privileged write to `users` and must use the
      // service-role/admin client to bypass RLS and avoid permission errors.
      const s = createAdminSupabaseClient()
      const { error } = await s.from('users').update({ ...data, updated_at: new Date().toISOString() }).eq('id', id)
      if (error) throw error
      const { data: user } = await s.from('users').select('*').eq('id', id).maybeSingle()
      return user ? migrateUser(user) : null
    },

    async setSubscriptionStatus(id: string, status: 'pending' | 'active' | 'suspended') {
      const updates: any = { subscription_status: status }
      if (status === 'active') {
        const now = new Date()
        updates.billing_start_date = now.toISOString()
        const endDate = new Date(now)
        endDate.setMonth(endDate.getMonth() + 1)
        updates.billing_end_date = endDate.toISOString()
      }
      return this.update(id, updates)
    },

    async delete(id: string) {
      // Deleting a user is a privileged operation; use the admin service-role client.
      const s = createAdminSupabaseClient()
      const { error } = await s.from('users').delete().eq('id', id)
      if (error) throw error
      return true
    },

    getPlanLimits(planType: 'starter' | 'pro' | 'enterprise') {
      return PLAN_LIMITS[planType]
    },

    async canAddPage(userId: string) {
      const user = await this.findById(userId)
      if (!user) return { allowed: false, reason: 'User not found' }
      const limits = PLAN_LIMITS[user.plan_type]
      if (limits.maxPages === -1) return { allowed: true }
      const s = supabase()
      const { data: tokens } = await s.from('tokens').select('*').eq('user_id', user.id)
      const pageCount = (tokens || []).length
      if (pageCount >= limits.maxPages) return { allowed: false, reason: `Your ${limits.name} plan allows only ${limits.maxPages} page(s). Upgrade to add more.` }
      return { allowed: true }
    },

    async canUseInstagram(userId: string) {
      const user = await this.findById(userId)
      if (!user) return false
      return PLAN_LIMITS[user.plan_type].hasInstagram
    }
  },

  tokens: {
    async create(data: { user_id: string; platform: 'facebook' | 'instagram'; page_id: string; page_name: string; access_token: string }) {
      const s = supabase()
      // Resolve provided user_id (may be auth UID) for safety; do not auto-create here
      const effectiveUserId = data.user_id ? (await resolveUserId(data.user_id, false)) || data.user_id : null
      const id = generateId()
      const now = new Date().toISOString()
      const token = { id, ...data, user_id: effectiveUserId, created_at: now, updated_at: now }
      const { error } = await s.from('tokens').insert(token)
      if (error) throw error
      return token
    },

    async findByUserId(userId: string) {
      const s = supabase()
      const effectiveUserId = (await resolveUserId(userId, false)) || userId
      const { data, error } = await s.from('tokens').select('*').eq('user_id', effectiveUserId)
      if (error) throw error
      return data || []
    },

    async findByPageId(pageId: string) {
      const s = supabase()
      const { data } = await s.from('tokens').select('*').eq('page_id', pageId).maybeSingle()
      return data || null
    },

    async update(id: string, data: any) {
      const s = supabase()
      const { error } = await s.from('tokens').update({ ...data, updated_at: new Date().toISOString() }).eq('id', id)
      if (error) throw error
      const { data: token } = await s.from('tokens').select('*').eq('id', id).maybeSingle()
      return token || null
    },

    async delete(id: string) {
      const s = supabase()
      const { error } = await s.from('tokens').delete().eq('id', id)
      if (error) throw error
      return true
    },

    async countByUserId(userId: string) {
      const s = supabase()
      const effectiveUserId = (await resolveUserId(userId, false)) || userId
      const { data, error } = await s.from('tokens').select('*').eq('user_id', effectiveUserId)
      if (error) throw error
      return (data || []).length
    }
  },

  settings: {
    async findByUserId(userId: string) {
      const s = supabase()
      const effectiveUserId = (await resolveUserId(userId, false)) || userId
      const { data } = await s.from('business_settings').select('*').eq('user_id', effectiveUserId).maybeSingle()
      return data || null
    },

    async update(userId: string, data: any) {
      const s = supabase()
      const effectiveUserId = (await resolveUserId(userId, false)) || userId
      const { data: existing } = await s.from('business_settings').select('*').eq('user_id', effectiveUserId).maybeSingle()
      if (!existing) return null
      const { error } = await s.from('business_settings').update({ ...data, updated_at: new Date().toISOString() }).eq('id', existing.id)
      if (error) throw error
      const { data: updated } = await s.from('business_settings').select('*').eq('id', existing.id).maybeSingle()
      return updated || null
    }
  },

  logs: {
    async add(data: { user_id?: string; level: 'info' | 'warn' | 'error' | 'lead'; message: string; meta?: Record<string, any> }) {
      const s = supabase()
      const entry = { id: generateId(), ...data, created_at: new Date().toISOString() }
      const { error } = await s.from('logs').insert(entry)
      if (error) throw error
      return entry
    },

    async getRecent(limit: number = 100) {
      const s = supabase()
      const { data } = await s.from('logs').select('*').order('created_at', { ascending: false }).limit(limit)
      return data || []
    },

    async getByUserId(userId: string, limit: number = 50) {
      const s = supabase()
      const { data } = await s.from('logs').select('*').eq('user_id', userId).order('created_at', { ascending: false }).limit(limit)
      return data || []
    }
  }
}

export type { } // keep TS happy for now

// Backwards compatibility: previously the project used `replitDb`. We no longer use Replit storage,
// but keep this alias so the rest of the codebase continues to work while imports are migrated.
export const replitDb = db;

