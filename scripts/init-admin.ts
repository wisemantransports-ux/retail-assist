import * as fs from 'fs';
import * as path from 'path';

const DATA_DIR = process.env.DATA_DIR || './.data';
const DB_PATH = path.join(DATA_DIR, 'database.json');

function generateSalt(): string {
  const array = new Uint8Array(16);
  crypto.getRandomValues(array);
  return Array.from(array).map(b => b.toString(16).padStart(2, '0')).join('');
}

async function hashPasswordWithSalt(password: string, salt: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(password + salt);
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  const hash = hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
  return `${salt}:${hash}`;
}

async function initAdmin() {
  const adminEmail = process.env.ADMIN_EMAIL || 'admin@example.com';
  const adminPassword = process.env.ADMIN_PASSWORD || 'admin123';

  console.log('Initializing admin user...');

  if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
  }

  let db: any = {
    users: {},
    tokens: {},
    business_settings: {},
    logs: []
  };

  if (fs.existsSync(DB_PATH)) {
    try {
      db = JSON.parse(fs.readFileSync(DB_PATH, 'utf-8'));
    } catch {
      console.log('Creating fresh database...');
    }
  }

  const existingAdmin = Object.values(db.users as any[]).find(
    (u: any) => u.email === adminEmail || u.role === 'admin'
  );

  if (existingAdmin) {
    console.log('Admin user already exists:', (existingAdmin as any).email);
    console.log('Updating admin password...');
    const salt = generateSalt();
    const password_hash = await hashPasswordWithSalt(adminPassword, salt);
    (existingAdmin as any).password_hash = password_hash;
    fs.writeFileSync(DB_PATH, JSON.stringify(db, null, 2));
    console.log('Admin password updated!');
    return;
  }

  const id = crypto.randomUUID();
  const now = new Date().toISOString();
  const salt = generateSalt();
  const password_hash = await hashPasswordWithSalt(adminPassword, salt);

  db.users[id] = {
    id,
    email: adminEmail,
    password_hash,
    business_name: 'Admin',
    phone: '',
    package: 'enterprise',
    status: 'active',
    role: 'admin',
    created_at: now,
    updated_at: now
  };

  fs.writeFileSync(DB_PATH, JSON.stringify(db, null, 2));

  console.log('Admin user created successfully!');
  console.log('Email:', adminEmail);
  console.log('Password:', adminPassword);
  console.log('');
  console.log('IMPORTANT: Change the password after first login!');
}

initAdmin().catch(console.error);
