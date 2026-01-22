#!/usr/bin/env node

const fs = require('fs');
const path = require('path');

// Import Supabase client
const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = 'https://dzrwxdjzgwvdmfbbfotn.supabase.co';
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImR6cnd4ZGp6Z3d2ZG1mYmJmb3RuIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2ODAzMjczOCwiZXhwIjoyMDgzNjA4NzM4fQ.IPGlFViY3cOjnp9aa3jTejEVvEi3p5mNpQvCSjAZFcc';

const supabase = createClient(supabaseUrl, serviceRoleKey);

async function applyMigration(migrationName) {
  try {
    console.log(`[Migration] Applying ${migrationName}...`);
    
    const migrationPath = path.join(__dirname, 'supabase', 'migrations', migrationName);
    const sql = fs.readFileSync(migrationPath, 'utf8');
    
    console.log(`[Migration] Read ${sql.length} bytes from ${migrationName}`);
    console.log(`[Migration] Executing SQL...`);
    
    // Execute the SQL
    const { error } = await supabase.rpc('exec', { sql }, { 
      head: true,
      count: null 
    });
    
    if (error) {
      console.error(`[Migration] Error executing migration:`, error);
      return false;
    }
    
    console.log(`[Migration] ✓ Successfully applied ${migrationName}`);
    return true;
  } catch (err) {
    console.error(`[Migration] Failed to apply ${migrationName}:`, err.message);
    return false;
  }
}

async function main() {
  // Apply migrations in order
  const migrations = [
    '032_create_employee_invite.sql',
    '033_add_full_name_to_employee_invites.sql',
    '033_accept_employee_invite.sql',
    '034_normalize_employee_workspace.sql',
    '035_employee_workspace_constraints.sql'
  ];
  
  for (const migration of migrations) {
    const success = await applyMigration(migration);
    if (!success) {
      console.log(`[Migration] Skipping ${migration} (may already be applied)`);
    }
  }
  
  console.log('[Migration] Done!');
}

main().catch(console.error);
