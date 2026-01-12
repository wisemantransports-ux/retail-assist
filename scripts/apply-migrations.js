#!/usr/bin/env node

const fs = require('fs');
const path = require('path');

// Read environment
require('dotenv').config({ path: path.join(__dirname, '..', '.env.local') });

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_URL || !SERVICE_KEY) {
  console.error('Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in .env.local');
  process.exit(1);
}

async function applySQLFile(filePath) {
  const sql = fs.readFileSync(filePath, 'utf8');
  const fileName = path.basename(filePath);

  console.log(`\n[${fileName}] Applying migration...`);

  // Split into statements (simple approach - split by ;)
  const statements = sql
    .split(';')
    .map(s => s.trim())
    .filter(s => s && !s.startsWith('--'));

  for (let i = 0; i < statements.length; i++) {
    const stmt = statements[i] + ';';
    
    try {
      const response = await fetch(`${SUPABASE_URL}/rest/v1/rpc/exec`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${SERVICE_KEY}`,
          'apikey': SERVICE_KEY
        },
        body: JSON.stringify({ sql: stmt })
      });

      if (!response.ok) {
        const text = await response.text();
        console.error(`[${fileName}] Statement ${i + 1} failed:`, text);
        throw new Error(`HTTP ${response.status}: ${text}`);
      }

      console.log(`[${fileName}] Statement ${i + 1}/${statements.length} applied ✓`);
    } catch (err) {
      console.error(`[${fileName}] Error applying statement ${i + 1}:`, err.message);
      throw err;
    }
  }

  console.log(`[${fileName}] ✅ Migration applied successfully!`);
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
      console.error(`\n❌ Failed to apply ${migrationFile}:`, err.message);
      process.exit(1);
    }
  }

  console.log('\n✅ All migrations applied successfully!');
}

main();
