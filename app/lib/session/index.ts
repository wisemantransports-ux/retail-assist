import { createServerClient } from '@/lib/supabase/server'
import { env } from '@/lib/env'
import * as fs from 'fs'
import * as path from 'path'

const supabase = () => createServerClient()
const DEV_SESSIONS = path.join(process.cwd(), 'tmp', 'dev-seed', 'sessions.json')

function generateSessionId(): string {
  return crypto.randomUUID() + '-' + crypto.randomUUID()
}

function readDevSessions() {
  try {
    if (!fs.existsSync(DEV_SESSIONS)) return {}
    return JSON.parse(fs.readFileSync(DEV_SESSIONS, 'utf-8'))
  } catch (e) {
    return {}
  }
}

function writeDevSessions(sessions: Record<string, any>) {
  fs.mkdirSync(path.dirname(DEV_SESSIONS), { recursive: true })
  fs.writeFileSync(DEV_SESSIONS, JSON.stringify(sessions, null, 2))
}

// Use the centralized mock-mode flag to determine dev fallback behavior
const useDev = env.useMockMode

export const sessionManager = {
  async create(userId: string, expiresInHours: number = 24 * 7) {
    if (!useDev) {
      const s = supabase()
      const id = generateSessionId()
      const now = new Date()
      const expiresAt = new Date(now.getTime() + expiresInHours * 60 * 60 * 1000)

      const session = {
        id,
        user_id: userId,
        created_at: now.toISOString(),
        expires_at: expiresAt.toISOString()
      }

      const { error } = await s.from('sessions').insert(session)
      if (error) throw error
      return session
    }

    const sessions = readDevSessions()
    const id = generateSessionId()
    const now = new Date()
    const expiresAt = new Date(now.getTime() + expiresInHours * 60 * 60 * 1000)

    const session = { id, user_id: userId, created_at: now.toISOString(), expires_at: expiresAt.toISOString() }
    sessions[id] = session
    writeDevSessions(sessions)
    return session
  },

  async validate(sessionId: string) {
    if (!sessionId) return null
    if (!useDev) {
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

    const sessions = readDevSessions()
    const data = sessions[sessionId]
    if (!data) return null
    if (new Date(data.expires_at) <= new Date()) {
      delete sessions[sessionId]
      writeDevSessions(sessions)
      return null
    }
    return data
  },

  async destroy(sessionId: string) {
    if (!useDev) {
      const s = supabase()
      await s.from('sessions').delete().eq('id', sessionId)
      return
    }
    const sessions = readDevSessions()
    delete sessions[sessionId]
    writeDevSessions(sessions)
  },

  async destroyAllForUser(userId: string) {
    if (!useDev) {
      const s = supabase()
      await s.from('sessions').delete().eq('user_id', userId)
      return
    }
    const sessions = readDevSessions()
    for (const k of Object.keys(sessions)) {
      if (sessions[k].user_id === userId) delete sessions[k]
    }
    writeDevSessions(sessions)
  },

  async cleanup() {
    if (!useDev) {
      const s = supabase()
      const now = new Date().toISOString()
      await s.from('sessions').delete().lt('expires_at', now)
      return
    }
    const sessions = readDevSessions()
    const now = new Date()
    for (const [k, v] of Object.entries(sessions)) {
      if (new Date((v as any).expires_at) <= now) delete sessions[k]
    }
    writeDevSessions(sessions)
  }
}

export type { }
