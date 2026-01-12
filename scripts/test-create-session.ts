import { sessionManager } from '../app/lib/session/index.ts'
import * as path from 'path'
import * as fs from 'fs'

;(async () => {
  const userId = '2da0bca7-5abd-471f-ae1e-a66e19b936cf'
  console.log('Creating session for', userId)
  try {
    const session = await sessionManager.create(userId, 24)
    console.log('Created session:', session)
    const sessionsPath = path.join(process.cwd(), 'tmp', 'dev-seed', 'sessions.json')
    const sessionsRaw = fs.readFileSync(sessionsPath, 'utf-8')
    const sessions = JSON.parse(sessionsRaw)
    const fileEntry = sessions[session.id]
    console.log('File entry user_id:', fileEntry?.user_id)
    if (fileEntry?.user_id === session.user_id) {
      console.log('SUCCESS: session.user_id matches file entry and equals', session.user_id)
    } else {
      console.error('MISMATCH: session.user_id != file entry')
    }
  } catch (e) {
    console.error('Error creating session:', e)
    process.exit(1)
  }
})()
