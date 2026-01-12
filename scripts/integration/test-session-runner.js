// Run with: node scripts/integration/test-session-runner.js
(async () => {
  try {
    // Import the shim that exposes a Node-friendly sessionManager (no TS path aliases)
    const { sessionManager } = require('../shims/sessionManager.cjs')

    const userId = '2da0bca7-5abd-471f-ae1e-a66e19b936cf'
    console.log('Creating session for', userId)
    const session = await sessionManager.create(userId, 24)
    console.log('Created session:', session)

    const fs = require('fs')
    const path = require('path')
    const sessionsPath = path.join(process.cwd(), 'tmp', 'dev-seed', 'sessions.json')
    const sessionsRaw = fs.readFileSync(sessionsPath, 'utf-8')
    const sessions = JSON.parse(sessionsRaw)
    const fileEntry = sessions[session.id]
    console.log('File entry user_id:', fileEntry?.user_id)

    if (fileEntry?.user_id === session.user_id) {
      console.log('SUCCESS: session.user_id matches file entry and equals', session.user_id)
      process.exit(0)
    } else {
      console.error('MISMATCH: session.user_id != file entry')
      process.exit(2)
    }
  } catch (e) {
    console.error('Test runner error:', e)
    process.exit(1)
  }
})()
