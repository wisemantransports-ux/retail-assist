import * as fs from 'fs'
import * as path from 'path'

const DEV_SESSIONS = path.join(process.cwd(), 'tmp', 'dev-seed', 'database.json')

function readDevDb() {
  try {
    if (!fs.existsSync(DEV_SESSIONS)) return {}
    return JSON.parse(fs.readFileSync(DEV_SESSIONS, 'utf-8'))
  } catch (e) {
    return {}
  }
}

function writeDevDb(db: any) {
  fs.mkdirSync(path.dirname(DEV_SESSIONS), { recursive: true })
  fs.writeFileSync(DEV_SESSIONS, JSON.stringify(db, null, 2))
}

export { readDevDb, writeDevDb }