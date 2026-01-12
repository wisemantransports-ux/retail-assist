#!/usr/bin/env node
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// Load environment
const envPath = path.join(__dirname, '..', '.env.local');
const envContent = fs.readFileSync(envPath, 'utf8');
const env: Record<string, string> = {};

envContent.split('\n').forEach(line => {
  const [key, ...valueParts] = line.split('=');
  if (key && valueParts.length > 0) {
    env[key.trim()] = valueParts.join('=').trim();
  }
});

const SUPABASE_URL = env['NEXT_PUBLIC_SUPABASE_URL'];
const SERVICE_KEY = env['SUPABASE_SERVICE_ROLE_KEY'];

if (!SUPABASE_URL || !SERVICE_KEY) {
  console.error('Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in .env.local');
  process.exit(1);
}

async function applySQLFile(filePath: string): Promise<void> {
  const sql = fs.readFileSync(filePath, 'utf8');
  const fileName = path.basename(filePath);

  console.log(`\n[${fileName}] Applying migration...`);

  try {
    const response = await fetch(`${SUPABASE_URL}/rest/v1/rpc/exec`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${SERVICE_KEY}`,
        'apikey': SERVICE_KEY
      },
      body: JSON.stringify({ sql })
    });

    const text = await response.text();

    if (!response.ok) {
      console.error(`[${fileName}] Failed (HTTP ${response.status}):`, text);
      throw new Error(`HTTP ${response.status}`);
    }

    console.log(`[${fileName}] ✅ Applied successfully!`);
  } catch (err: any) {
    console.error(`[${fileName}] Error:`, err.message);
    throw err;
  }
}

async function main() {
  const migrations = ['025_fix_sessions_fk.sql', '026_update_rpc_create_user_profile.sql'];

  for (const migrationFile of migrations) {
    const filePath = path.join(__dirname, '..', 'supabase', 'migrations', migrationFile);
    if (!fs.existsSync(filePath)) {
      console.warn(`⚠️  Migration not found: ${filePath}`);
      continue;
    }

    try {
      await applySQLFile(filePath);
    } catch (err) {
      console.error(`\n❌ Failed to apply ${migrationFile}`);
      process.exit(1);
    }
  }

  console.log('\n✅ All migrations applied successfully!');
}

main().catch(err => {
  console.error('Fatal error:', err);
  process.exit(1);
});
