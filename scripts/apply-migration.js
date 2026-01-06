const fetch = require('node-fetch');
const fs = require('fs');
const path = require('path');

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_URL || !SERVICE_KEY) {
  console.error('Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY');
  process.exit(1);
}

async function runMigration() {
  try {
    const migrationPath = path.join(__dirname, '..', 'supabase', 'migrations', '008_ai_usage_tracking.sql');
    const sql = fs.readFileSync(migrationPath, 'utf8');

    console.log('Applying AI usage tracking migration...');

    const url = `${SUPABASE_URL}/rest/v1/rpc/exec_sql`;
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${SERVICE_KEY}`,
        'apikey': SERVICE_KEY
      },
      body: JSON.stringify({ sql })
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('Migration failed:', errorText);
      process.exit(1);
    }

    const result = await response.json();
    console.log('Migration applied successfully!', result);
  } catch (err) {
    console.error('Error:', err);
    process.exit(1);
  }
}

runMigration();