const fs = require('fs')
const path = require('path')
const crypto = require('crypto')

const DEV_DB = path.join(process.cwd(), 'tmp', 'dev-seed', 'database.json')
const DEV_SESSIONS = path.join(process.cwd(), 'tmp', 'dev-seed', 'sessions.json')

function generateSessionId() {
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

function writeDevSessions(sessions) {
  fs.mkdirSync(path.dirname(DEV_SESSIONS), { recursive: true })
  fs.writeFileSync(DEV_SESSIONS, JSON.stringify(sessions, null, 2))
}

function readDevDb() {
  try {
    if (!fs.existsSync(DEV_DB)) return null
    return JSON.parse(fs.readFileSync(DEV_DB, 'utf-8'))
  } catch (e) {
    return null
  }
}

const sessionManager = {
  async create(userId, expiresInHours = 24 * 7) {
    // Resolve to an existing internal user id from dev DB if present
    const db = readDevDb()
    let effectiveUserId = userId
    try {
      if (db && db.users && db.users[userId]) {
        effectiveUserId = userId
      }
    } catch (e) {
      // ignore
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

    const sessions = readDevSessions()
    sessions[id] = session
    writeDevSessions(sessions)
    return session
  },

  async validate(sessionId) {
    if (!sessionId) return null
    const sessions = readDevSessions()
    const data = sessions[sessionId]
    if (!data) return null
    if (new Date(data.expires_at) <= new Date()) {
      delete sessions[sessionId]
      writeDevSessions(sessions)
      return null
    }
    return data
  }
}

module.exports = { sessionManager }
