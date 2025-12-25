#!/usr/bin/env node
const fs = require('fs')
const path = require('path')

const DATA_DIR = process.env.DATA_DIR || './.data'
const DB_PATH = path.join(DATA_DIR, 'database.json')
const SESSIONS_PATH = path.join(DATA_DIR, 'sessions.json')
const OUT_DIR = path.join(process.cwd(), 'tmp', 'migration-output')

function ensureOutDir() {
  if (!fs.existsSync(OUT_DIR)) fs.mkdirSync(OUT_DIR, { recursive: true })
}

function readJsonSafe(p) {
  if (!fs.existsSync(p)) return null
  try {
    return JSON.parse(fs.readFileSync(p, 'utf-8'))
  } catch (e) {
    console.error('Failed to parse', p, e)
    return null
  }
}

ensureOutDir()

const db = readJsonSafe(DB_PATH)
const sessions = readJsonSafe(SESSIONS_PATH)

if (!db) {
  console.warn('No database.json found at', DB_PATH)
  process.exit(0)
}

fs.writeFileSync(path.join(OUT_DIR, 'users.json'), JSON.stringify(db.users || {}, null, 2))
fs.writeFileSync(path.join(OUT_DIR, 'tokens.json'), JSON.stringify(db.tokens || {}, null, 2))
fs.writeFileSync(path.join(OUT_DIR, 'business_settings.json'), JSON.stringify(db.business_settings || {}, null, 2))
fs.writeFileSync(path.join(OUT_DIR, 'logs.json'), JSON.stringify(db.logs || [], null, 2))
if (sessions) fs.writeFileSync(path.join(OUT_DIR, 'sessions.json'), JSON.stringify(sessions, null, 2))

console.log('Exported Replit DB to', OUT_DIR)
console.log('Files created: users.json, tokens.json, business_settings.json, logs.json' + (sessions ? ', sessions.json' : ''))
console.log('\nNext steps:')
console.log('- Review the exported files in tmp/migration-output before running live migration')
console.log('- Use scripts/migrate-replit-to-supabase.ts with --run once SUPABASE env vars are set to perform live migration')
