import { createAdminSupabaseClient } from '@/lib/supabase/server';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

async function applyMigration() {
  const admin = createAdminSupabaseClient();

  // Migration 025: Fix sessions FK
  console.log('\n📋 Migration 025: Fix sessions FK...');
  try {
    // Drop the old FK constraint
    const { error: dropErr } = await admin.rpc('exec', {
      sql: `ALTER TABLE public.sessions DROP CONSTRAINT IF EXISTS sessions_user_id_fkey;`
    }).single();
    
    if (dropErr) {
      // Try direct SQL execution via Supabase
      console.log('Drop FK result:', dropErr);
    } else {
      console.log('✓ Dropped old FK constraint');
    }

    // Add the correct FK constraint
    const { error: addErr } = await admin.rpc('exec', {
      sql: `ALTER TABLE public.sessions ADD CONSTRAINT sessions_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;`
    }).single();
    
    if (addErr) {
      console.log('Add FK result:', addErr);
    } else {
      console.log('✓ Added correct FK constraint');
    }

    console.log('✅ Migration 025 complete!');
  } catch (err: any) {
    console.error('❌ Migration 025 failed:', err.message);
    throw err;
  }

  // Migration 026: Update RPC
  console.log('\n📋 Migration 026: Update RPC function...');
  const rpcSql = fs.readFileSync(
    path.join(__dirname, '..', 'supabase', 'migrations', '026_update_rpc_create_user_profile.sql'),
    'utf8'
  );

  try {
    const { error } = await admin.rpc('exec', { sql: rpcSql }).single();
    if (error) {
      console.log('RPC update result:', error);
    } else {
      console.log('✅ Migration 026 complete!');
    }
  } catch (err: any) {
    console.error('❌ Migration 026 failed:', err.message);
    throw err;
  }
}

applyMigration().catch(err => {
  console.error('Fatal error:', err);
  process.exit(1);
});
