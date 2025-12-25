const fs = require('fs')
const path = require('path')

const OUT = path.join(process.cwd(), 'tmp', 'dev-seed')
if (!fs.existsSync(OUT)) fs.mkdirSync(OUT, { recursive: true })

const now = new Date().toISOString()
const adminId = '00000000-0000-0000-0000-000000000001'
const clientId = '00000000-0000-0000-0000-000000000002'

const users = {
  [adminId]: {
    id: adminId,
    email: 'admin@example.com',
    password: 'admin123',
    business_name: 'Admin Corp',
    phone: '',
    plan_type: 'enterprise',
    payment_status: 'paid',
    subscription_status: 'active',
    role: 'admin',
    created_at: now,
    updated_at: now
  },
  [clientId]: {
    id: clientId,
    email: 'client@example.com',
    password: 'client123',
    business_name: 'Client Co',
    phone: '',
    plan_type: 'starter',
    payment_status: 'unpaid',
    subscription_status: 'pending',
    role: 'user',
    created_at: now,
    updated_at: now
  }
}

const tokens = {}
const business_settings = {}
const logs = []
const sessions = {}

fs.writeFileSync(path.join(OUT, 'database.json'), JSON.stringify({ users, tokens, business_settings, logs }, null, 2))
fs.writeFileSync(path.join(OUT, 'sessions.json'), JSON.stringify(sessions, null, 2))

console.log('Dev seed created at tmp/dev-seed')
console.log('Admin: admin@example.com / admin123')
console.log('Client: client@example.com / client123')
