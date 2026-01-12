const fs = require('fs')
const path = require('path')

function generateSessionId() {
  return crypto.randomUUID ? crypto.randomUUID() + '-' + crypto.randomUUID() : require('crypto').randomUUID() + '-' + require('crypto').randomUUID()
}

;(async () => {
  const userId = process.argv[2] || '2da0bca7-5abd-471f-ae1e-a66e19b936cf'
  const sessionsPath = path.join(process.cwd(), 'tmp', 'dev-seed', 'sessions.json')
  let sessions = {}
  if (fs.existsSync(sessionsPath)) {
    try { sessions = JSON.parse(fs.readFileSync(sessionsPath, 'utf8')) } catch(e) { sessions = {} }
  }

  const id = generateSessionId()
  const now = new Date()
  const expiresAt = new Date(now.getTime() + 24 * 60 * 60 * 1000)
  const session = {
    id,
    user_id: userId,
    created_at: now.toISOString(),
    expires_at: expiresAt.toISOString()
  }

  sessions[id] = session
  fs.mkdirSync(path.dirname(sessionsPath), { recursive: true })
  fs.writeFileSync(sessionsPath, JSON.stringify(sessions, null, 2))
  console.log('Wrote session:', session)
  console.log('File user_id:', JSON.parse(fs.readFileSync(sessionsPath, 'utf8'))[id].user_id)
})()
