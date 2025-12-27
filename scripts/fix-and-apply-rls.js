/**
 * Generate Corrected RLS Policies for Agents Table
 * 
 * Outputs safe, non-recursive RLS policies using EXISTS instead of IN
 * to prevent infinite recursion in workspace_members policies
 */

import dotenv from 'dotenv';

dotenv.config();

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;

if (!SUPABASE_URL) {
  console.error('❌ Missing NEXT_PUBLIC_SUPABASE_URL');
  process.exit(1);
}

const sqlStatements = [
  `-- Step 1: Enable RLS on agents table
ALTER TABLE agents ENABLE ROW LEVEL SECURITY;`,

  `-- Step 2: Drop existing policies (clean slate)
DROP POLICY IF EXISTS agents_select_authenticated ON agents;
DROP POLICY IF EXISTS agents_insert_admin_only ON agents;
DROP POLICY IF EXISTS agents_update_admin_only ON agents;
DROP POLICY IF EXISTS agents_delete_admin_only ON agents;
DROP POLICY IF EXISTS agents_select ON agents;
DROP POLICY IF EXISTS agents_insert ON agents;
DROP POLICY IF EXISTS agents_update ON agents;
DROP POLICY IF EXISTS agents_delete ON agents;`,

  `-- Step 3a: SELECT - Allow workspace members to read agents
CREATE POLICY agents_select_authenticated ON agents
FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM workspace_members
    WHERE workspace_members.workspace_id = agents.workspace_id
      AND workspace_members.user_id = auth.uid()
  )
);`,

  `-- Step 3b: INSERT - Only admin/owner can create agents
CREATE POLICY agents_insert_admin_only ON agents
FOR INSERT
TO authenticated
WITH CHECK (
  EXISTS (
    SELECT 1 FROM workspace_members
    WHERE workspace_members.workspace_id = agents.workspace_id
      AND workspace_members.user_id = auth.uid()
      AND workspace_members.role IN ('admin', 'owner')
  )
);`,

  `-- Step 3c: UPDATE - Only admin/owner can update agents
CREATE POLICY agents_update_admin_only ON agents
FOR UPDATE
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM workspace_members
    WHERE workspace_members.workspace_id = agents.workspace_id
      AND workspace_members.user_id = auth.uid()
      AND workspace_members.role IN ('admin', 'owner')
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1 FROM workspace_members
    WHERE workspace_members.workspace_id = agents.workspace_id
      AND workspace_members.user_id = auth.uid()
      AND workspace_members.role IN ('admin', 'owner')
  )
);`,

  `-- Step 3d: DELETE - Only admin/owner can delete agents
CREATE POLICY agents_delete_admin_only ON agents
FOR DELETE
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM workspace_members
    WHERE workspace_members.workspace_id = agents.workspace_id
      AND workspace_members.user_id = auth.uid()
      AND workspace_members.role IN ('admin', 'owner')
  )
);`
];

console.log('═'.repeat(80));
console.log('🔧 CORRECTED RLS POLICIES FOR AGENTS TABLE');
console.log('═'.repeat(80));
console.log('');
console.log('Problem: Infinite recursion in workspace_members policies');
console.log('Solution: Replace with safe policies using EXISTS');
console.log('');
console.log('═'.repeat(80));
console.log('📋 SQL TO APPLY IN SUPABASE SQL EDITOR');
console.log('═'.repeat(80));
console.log('');

sqlStatements.forEach(stmt => {
  console.log(stmt);
  console.log('');
});

console.log('═'.repeat(80));
console.log('');
console.log('📍 NEXT STEPS:');
console.log('');
console.log('1. Open Supabase Dashboard:');
const urlPart = SUPABASE_URL.split('https://')[1];
console.log(`   https://${urlPart}/project/_/sql/new`);
console.log('');
console.log('2. Click "New Query"');
console.log('');
console.log('3. Copy all SQL above and paste into the editor');
console.log('');
console.log('4. Click "Run"');
console.log('');
console.log('5. Return here and run:');
console.log('   node scripts/test-workspace-provisioning-and-rls.js');
console.log('');
console.log('═'.repeat(80));
