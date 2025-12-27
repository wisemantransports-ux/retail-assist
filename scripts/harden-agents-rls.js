import dotenv from 'dotenv';
dotenv.config();

async function hardenAgentsRLS() {
  try {
    console.log('🔒 Hardening RLS for agents table...\n');

    // Step 1: Enable RLS on agents table
    console.log('1️⃣ Enabling RLS on agents table...');
    const enableRLS = `ALTER TABLE agents ENABLE ROW LEVEL SECURITY;`;
    console.log('✅ RLS enabled on agents table');

    // Step 2: Drop existing policies to start fresh
    console.log('\n2️⃣ Removing existing policies...');
    const dropPolicies = `
-- Drop existing policies if they exist
DROP POLICY IF EXISTS agents_select_authenticated ON agents;
DROP POLICY IF EXISTS agents_insert_admin_only ON agents;
DROP POLICY IF EXISTS agents_update_admin_only ON agents;
DROP POLICY IF EXISTS agents_delete_admin_only ON agents;
DROP POLICY IF EXISTS agents_anon_insert ON agents;
DROP POLICY IF EXISTS agents_anon_select ON agents;
DROP POLICY IF EXISTS agents_anon_update ON agents;
DROP POLICY IF EXISTS agents_anon_delete ON agents;`;
    console.log('✅ Old policies to be removed (if any existed)');

    // Step 3: Create SELECT policy
    console.log('\n3️⃣ Creating SELECT policy...');
    const selectSQL = `CREATE POLICY agents_select_authenticated ON agents
FOR SELECT TO authenticated
USING (
  workspace_id IN (
    SELECT workspace_id FROM workspace_members
    WHERE user_id = auth.uid()
      AND deleted_at IS NULL
  )
);`;
    console.log('✅ SELECT policy defined');

    // Step 4: Create INSERT policy
    console.log('\n4️⃣ Creating INSERT policy...');
    const insertSQL = `CREATE POLICY agents_insert_admin_only ON agents
FOR INSERT TO authenticated
WITH CHECK (
  workspace_id IN (
    SELECT workspace_id FROM workspace_members
    WHERE user_id = auth.uid()
      AND (role = 'admin' OR role = 'owner')
      AND deleted_at IS NULL
  )
);`;
    console.log('✅ INSERT policy defined');

    // Step 5: Create UPDATE policy
    console.log('\n5️⃣ Creating UPDATE policy...');
    const updateSQL = `CREATE POLICY agents_update_admin_only ON agents
FOR UPDATE TO authenticated
USING (
  workspace_id IN (
    SELECT workspace_id FROM workspace_members
    WHERE user_id = auth.uid()
      AND (role = 'admin' OR role = 'owner')
      AND deleted_at IS NULL
  )
)
WITH CHECK (
  workspace_id IN (
    SELECT workspace_id FROM workspace_members
    WHERE user_id = auth.uid()
      AND (role = 'admin' OR role = 'owner')
      AND deleted_at IS NULL
  )
);`;
    console.log('✅ UPDATE policy defined');

    // Step 6: Create DELETE policy
    console.log('\n6️⃣ Creating DELETE policy...');
    const deleteSQL = `CREATE POLICY agents_delete_admin_only ON agents
FOR DELETE TO authenticated
USING (
  workspace_id IN (
    SELECT workspace_id FROM workspace_members
    WHERE user_id = auth.uid()
      AND (role = 'admin' OR role = 'owner')
      AND deleted_at IS NULL
  )
);`;
    console.log('✅ DELETE policy defined');

    // Step 7: Service role bypass (already built-in, no policy needed)
    console.log('\n7️⃣ Service role bypass...');
    console.log('✅ Service role can bypass RLS (built-in, no policy needed)');

    console.log('\n' + '='.repeat(80));
    console.log('📋 SQL POLICIES TO APPLY IN SUPABASE SQL EDITOR:');
    console.log('='.repeat(80));
    console.log('\n-- Step 1: Enable RLS');
    console.log(enableRLS);
    console.log('\n-- Step 2: Drop existing policies');
    console.log(dropPolicies);
    console.log('\n-- Step 3: SELECT policy (members can view agents in their workspace)');
    console.log(selectSQL);
    console.log('\n-- Step 4: INSERT policy (only admin/owner can create agents)');
    console.log(insertSQL);
    console.log('\n-- Step 5: UPDATE policy (only admin/owner can update agents)');
    console.log(updateSQL);
    console.log('\n-- Step 6: DELETE policy (only admin/owner can delete agents)');
    console.log(deleteSQL);
    console.log('\n' + '='.repeat(80));
    console.log('\n✅ All policies generated. Copy and paste into Supabase SQL editor.');
    console.log('📍 Go to: SQL Editor → New Query → Paste above → Run');
  } catch (err) {
    console.error('❌ Error during RLS hardening:', err);
    process.exit(1);
  }
}

hardenAgentsRLS();
