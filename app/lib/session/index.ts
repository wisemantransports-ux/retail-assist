import { createServerClient, createAdminSupabaseClient } from '@/lib/supabase/server'
import { ensureInternalUser } from '@/lib/supabase/queries'
import { env } from '@/lib/env'

// Do NOT import fs/path at module top-level. They will be imported lazily only when needed.

const supabase = () => createAdminSupabaseClient()

function generateSessionId(): string {
  return crypto.randomUUID()
}

async function readDevSessions() {
  try {
    const fs = await import('fs')
    const path = await import('path')
    const DEV_SESSIONS = path.join(process.cwd(), 'tmp', 'dev-seed', 'sessions.json')
    if (!fs.existsSync(DEV_SESSIONS)) return {}
    return JSON.parse(fs.readFileSync(DEV_SESSIONS, 'utf-8'))
  } catch (e) {
    return {}
  }
}

async function writeDevSessions(sessions: Record<string, any>) {
  const fs = await import('fs')
  const path = await import('path')
  const DEV_SESSIONS = path.join(process.cwd(), 'tmp', 'dev-seed', 'sessions.json')
  fs.mkdirSync(path.dirname(DEV_SESSIONS), { recursive: true })
  fs.writeFileSync(DEV_SESSIONS, JSON.stringify(sessions, null, 2))
}

// Use the centralized mock-mode flag to determine dev fallback behavior
const useDev = () => env.useMockMode

export const sessionManager = {
  async create(userId: string, expiresInHours: number = 24 * 7) {
    // The sessions table FK currently points to auth.users(id), but ideally should point to public.users(id).
    // Until the FK is migrated, we'll attempt to store the auth UID first, but if that fails,
    // we'll store the internal user ID instead and handle resolution in the validate/get methods.
    
    let effectiveUserId = userId
    
    // Try to resolve to auth UID if we received an internal ID
    try {
      const s = supabase()
      // First check if this is already an auth UID
      const { data: byAuth } = await s.from('users').select('auth_uid').eq('auth_uid', userId).maybeSingle()
      if (byAuth && (byAuth as any).auth_uid) {
        effectiveUserId = (byAuth as any).auth_uid
        console.info('[sessionManager.create] Confirmed auth_uid:', effectiveUserId)
      } else {
        // It's an internal ID, get the auth_uid
        const { data: byId } = await s.from('users').select('auth_uid').eq('id', userId).maybeSingle()
        if (byId && (byId as any).auth_uid) {
          effectiveUserId = (byId as any).auth_uid
          console.info('[sessionManager.create] Found auth_uid from internal ID:', effectiveUserId)
        }
      }
    } catch (e: any) {
      console.warn('[sessionManager.create] Could not resolve to auth_uid:', e?.message)
    }

    const id = generateSessionId()
    const now = new Date()
    const expiresAt = new Date(now.getTime() + expiresInHours * 60 * 60 * 1000)

    const session = {
      id,
      user_id: effectiveUserId,
      created_at: now.toISOString(),
      expires_at: expiresAt.toISOString(),
    }

    if (!useDev()) {
      const s = supabase()
      // Try to insert with auth UID first (as per current FK)
      let { error } = await s.from('sessions').insert(session)
      
      // If FK constraint fails because it's pointing to public.users instead of auth.users,
      // try inserting the internal user ID instead
      if (error && error.code === '23503') {
        console.warn('[sessionManager.create] Auth UID insert failed, trying internal user ID:', error.message)
        // Try with the original userId (which should be the internal ID)
        const sessionWithInternal = { ...session, user_id: userId }
        const { error: error2 } = await s.from('sessions').insert(sessionWithInternal)
        if (error2) {
          console.error('[sessionManager.create] Both insert attempts failed:', error2)
          throw error2
        }
      } else if (error) {
        console.error('[sessionManager.create] Insert error:', error)
        throw error
      }
      
      console.info('[sessionManager.create] Session created:', id)
      return session
    }

    const sessions = await readDevSessions()
    sessions[id] = session
    await writeDevSessions(sessions)
    return session
  },

  async validate(sessionId: string) {
    if (!sessionId) return null
    if (!useDev()) {
      const s = supabase()
      const { data, error } = await s.from('sessions').select('*').eq('id', sessionId).maybeSingle()
      if (error) {
        console.error('[Session] validate error:', error.message)
        return null
      }
      if (!data) return null
      if (new Date(data.expires_at) <= new Date()) {
        await s.from('sessions').delete().eq('id', sessionId)
        return null
      }
      return data
    }

    const sessions = await readDevSessions()
    const data = sessions[sessionId]
    if (!data) return null
    if (new Date(data.expires_at) <= new Date()) {
      delete sessions[sessionId]
      await writeDevSessions(sessions)
      return null
    }
    return data
  },

  async destroy(sessionId: string) {
    if (!useDev()) {
      const s = supabase()
      await s.from('sessions').delete().eq('id', sessionId)
      return
    }
    const sessions = await readDevSessions()
    delete sessions[sessionId]
    await writeDevSessions(sessions)
  },

  async destroyAllForUser(userId: string) {
    if (!useDev()) {
      const s = supabase()
      await s.from('sessions').delete().eq('user_id', userId)
      return
    }
    const sessions = await readDevSessions()
    for (const k of Object.keys(sessions)) {
      if (sessions[k].user_id === userId) delete sessions[k]
    }
    await writeDevSessions(sessions)
  },

  async cleanup() {
    if (!useDev()) {
      const s = supabase()
      const now = new Date().toISOString()
      await s.from('sessions').delete().lt('expires_at', now)
      return
    }
    const sessions = await readDevSessions()
    const now = new Date()
    for (const [k, v] of Object.entries(sessions)) {
      if (new Date((v as any).expires_at) <= now) delete sessions[k]
    }
    await writeDevSessions(sessions)
  }
}

export type { }
