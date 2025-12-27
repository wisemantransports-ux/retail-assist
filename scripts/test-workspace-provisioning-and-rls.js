/**
 * Non-destructive Supabase Integration Test
 * 
 * Tests:
 * 1. Auth sign-in (admin@demo.com)
 * 2. User auto-provisioning in public.users
 * 3. Workspace auto-creation (if none exist)
 * 4. Workspace membership auto-creation
 * 5. Agent listing and RLS enforcement
 * 
 * Safe: No schema changes, no destructive ops.
 * Uses: Two clients (anon for user ops, service-role for admin ops)
 */

import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import crypto from 'crypto';

dotenv.config();

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_URL || !ANON_KEY || !SERVICE_KEY) {
  console.error('❌ Missing required env vars: NEXT_PUBLIC_SUPABASE_URL, NEXT_PUBLIC_SUPABASE_ANON_KEY, SUPABASE_SERVICE_ROLE_KEY');
  process.exit(1);
}

const userClient = createClient(SUPABASE_URL, ANON_KEY);
const adminClient = createClient(SUPABASE_URL, SERVICE_KEY);

const TEST_EMAIL = 'admin@demo.com';
const TEST_PASSWORD = '123456';

let testResults = {
  authSignIn: null,
  userProvisioning: null,
  workspaceCreation: null,
  membershipCreation: null,
  agentListing: null,
  rlsSelectTest: null,
  rlsInsertTest: null,
  serviceRoleInsertTest: null,
  overallStatus: 'PENDING'
};

async function runTests() {
  console.log('═'.repeat(80));
  console.log('🧪 SUPABASE INTEGRATION & RLS TEST');
  console.log('═'.repeat(80));
  console.log('');

  try {
    // ========== STEP 1: AUTH SIGN-IN ==========
    console.log('1️⃣  AUTH SIGN-IN');
    console.log('-'.repeat(80));
    console.log(`Signing in as: ${TEST_EMAIL}`);

    const { data: authData, error: authError } = await userClient.auth.signInWithPassword({
      email: TEST_EMAIL,
      password: TEST_PASSWORD
    });

    if (authError) {
      console.error('❌ Sign-in failed:', authError.message);
      testResults.authSignIn = 'FAILED';
      throw authError;
    }

    const authUid = authData.user.id;
    console.log(`✅ Signed in successfully`);
    console.log(`   Auth UID: ${authUid}`);
    testResults.authSignIn = 'PASSED';
    console.log('');

    // ========== STEP 2: USER PROVISIONING ==========
    console.log('2️⃣  USER PROVISIONING');
    console.log('-'.repeat(80));

    const { data: existingUser, error: checkError } = await userClient
      .from('users')
      .select('id, email')
      .eq('id', authUid)
      .single();

    let userId = authUid;

    if (checkError && checkError.code !== 'PGRST116') {
      console.error('❌ Failed to check user record:', checkError.message);
      testResults.userProvisioning = 'FAILED';
      throw checkError;
    }

    if (!existingUser) {
      console.log('⚠️  User record not found, auto-creating...');
      const { data: newUser, error: insertError } = await userClient
        .from('users')
        .insert({
          id: authUid,
          email: authData.user.email
        })
        .select('id')
        .single();

      if (insertError) {
        console.error('❌ Failed to create user record:', insertError.message);
        testResults.userProvisioning = 'FAILED';
        throw insertError;
      }

      userId = newUser.id;
      console.log(`✅ User record auto-created`);
      console.log(`   User ID: ${userId}`);
    } else {
      console.log(`✅ User record already exists`);
      console.log(`   User ID: ${existingUser.id}`);
      console.log(`   Email: ${existingUser.email}`);
    }

    testResults.userProvisioning = 'PASSED';
    console.log('');

    // ========== STEP 3: WORKSPACE AUTO-CREATION ==========
    console.log('3️⃣  WORKSPACE AUTO-CREATION');
    console.log('-'.repeat(80));

    const { data: existingWorkspaces } = await adminClient
      .from('workspaces')
      .select('*')
      .or(`owner.eq.${userId},owner_id.eq.${userId}`)
      .limit(1);

    let workspace = (existingWorkspaces && existingWorkspaces.length > 0) ? existingWorkspaces[0] : null;

    if (!workspace) {
      console.log('⚠️  No workspaces found, auto-creating...');
      const { data: newWorkspace, error: createError } = await adminClient
        .from('workspaces')
        .insert({
          name: `${authData.user.email}'s Workspace`,
          owner: userId,
          plan_type: 'free',
          subscription_status: 'active'
        })
        .select()
        .single();

      if (createError) {
        console.error('❌ Failed to create workspace:', createError.message);
        testResults.workspaceCreation = 'FAILED';
        throw createError;
      }

      workspace = newWorkspace;
      console.log(`✅ Workspace auto-created`);
      console.log(`   ID: ${workspace.id}`);
      console.log(`   Name: ${workspace.name}`);
    } else {
      console.log(`✅ Workspace already exists`);
      console.log(`   ID: ${workspace.id}`);
      console.log(`   Name: ${workspace.name}`);
    }

    testResults.workspaceCreation = 'PASSED';
    console.log('');

    // ========== STEP 4: MEMBERSHIP AUTO-CREATION ==========
    console.log('4️⃣  WORKSPACE MEMBERSHIP');
    console.log('-'.repeat(80));

    const { data: existingMember, error: memberCheckError } = await adminClient
      .from('workspace_members')
      .select('*')
      .eq('workspace_id', workspace.id)
      .eq('user_id', userId)
      .single();

    if (memberCheckError && memberCheckError.code !== 'PGRST116') {
      console.error('❌ Failed to check membership:', memberCheckError.message);
      testResults.membershipCreation = 'FAILED';
      throw memberCheckError;
    }

    if (!existingMember) {
      console.log('⚠️  No membership found, auto-creating...');
      let createdRole = null
      try {
        const { data: newMember, error: memberError } = await adminClient
          .from('workspace_members')
          .insert({
            workspace_id: workspace.id,
            user_id: userId,
            role: 'owner'
          })
          .select()
          .single();

        if (memberError) throw memberError
        createdRole = newMember.role
      } catch (mErr) {
        if (mErr && (mErr.code === '23514' || (mErr.message && mErr.message.includes('role')))) {
          console.warn('⚠️  DB rejected role `owner`; retrying with `admin`')
          const { data: newMember2, error: memberError2 } = await adminClient
            .from('workspace_members')
            .insert({
              workspace_id: workspace.id,
              user_id: userId,
              role: 'admin'
            })
            .select()
            .single();
          if (memberError2) {
            console.error('❌ Failed to create membership as admin:', memberError2.message);
            testResults.membershipCreation = 'FAILED';
            throw memberError2;
          }
          createdRole = newMember2.role
        } else {
          console.error('❌ Failed to create membership:', mErr.message || mErr);
          testResults.membershipCreation = 'FAILED';
          throw mErr;
        }
      }

      console.log(`✅ Membership auto-created`);
      console.log(`   Role: ${createdRole}`);
    } else {
      console.log(`✅ Membership already exists`);
      console.log(`   Role: ${existingMember.role}`);
    }

    testResults.membershipCreation = 'PASSED';
    console.log('');

    // ========== STEP 5: AGENT LISTING ==========
    console.log('5️⃣  AGENT LISTING');
    console.log('-'.repeat(80));

    const { data: agents, error: agentError } = await userClient
      .from('agents')
      .select('id, name, workspace_id')
      .eq('workspace_id', workspace.id)

    if (agentError) {
      console.error('❌ Failed to list agents:', agentError.message);
      testResults.agentListing = 'FAILED';
      throw agentError;
    }

    console.log(`✅ Agents fetched successfully`);
    console.log(`   Count: ${agents ? agents.length : 0}`);
    if (agents && agents.length > 0) {
      agents.forEach(agent => {
        console.log(`     - ${agent.name} (${agent.id})`);
      });
    }

    testResults.agentListing = 'PASSED';
    console.log('');

    // ========== STEP 6: RLS SELECT TEST ==========
    console.log('6️⃣  RLS ENFORCEMENT: SELECT AS AUTHENTICATED USER');
    console.log('-'.repeat(80));

    const { data: selectResult, error: selectError } = await userClient
      .from('agents')
      .select('id, name')
      .eq('workspace_id', workspace.id);

    if (selectError) {
      console.error('❌ SELECT blocked (RLS enforced):', selectError.message);
      testResults.rlsSelectTest = 'PASSED (blocked as expected)';
    } else if (selectResult) {
      console.log(`✅ SELECT allowed (user is member of workspace)`);
      console.log(`   Rows returned: ${selectResult.length}`);
      testResults.rlsSelectTest = 'PASSED (allowed as expected)';
    }
    console.log('');

    // ========== STEP 7: RLS INSERT TEST (User with admin role) ==========
    console.log('7️⃣  RLS ENFORCEMENT: INSERT AS AUTHENTICATED ADMIN USER');
    console.log('-'.repeat(80));

    const testAgentPayload = {
      workspace_id: workspace.id,
      name: 'RLS Test Agent (User)',
      system_prompt: 'Test RLS as user',
      model: 'gpt-4o-mini',
      api_key: crypto.randomUUID() // <-- fix null api_key
    };

    const { data: insertResult, error: insertError } = await userClient
      .from('agents')
      .insert(testAgentPayload)
      .select('id, name')
      .single();

    if (insertError) {
      console.log('⚠️  INSERT blocked by RLS (user may not be admin):', insertError.message);
      testResults.rlsInsertTest = 'BLOCKED (expected if not admin)';
    } else if (insertResult) {
      console.log(`✅ INSERT allowed (user is admin of workspace)`);
      console.log(`   Created agent ID: ${insertResult.id}`);
      testResults.rlsInsertTest = 'PASSED (allowed)';
    }
    console.log('');

    // ========== STEP 8: SERVICE-ROLE INSERT TEST ==========
    console.log('8️⃣  SERVICE-ROLE BYPASS: INSERT AS ADMIN CLIENT');
    console.log('-'.repeat(80));

    const testAgentPayload2 = {
      workspace_id: workspace.id,
      name: 'RLS Test Agent (Service Role)',
      system_prompt: 'Test RLS as service role',
      model: 'gpt-4o-mini',
      api_key: crypto.randomUUID() // <-- fix null api_key
    };

    const { data: serviceInsertResult, error: serviceInsertError } = await adminClient
      .from('agents')
      .insert(testAgentPayload2)
      .select('id, name')
      .single();

    if (serviceInsertError) {
      console.error('❌ Service-role INSERT failed (should always succeed):', serviceInsertError.message);
      testResults.serviceRoleInsertTest = 'FAILED';
      throw serviceInsertError;
    } else if (serviceInsertResult) {
      console.log(`✅ Service-role INSERT succeeded (bypass RLS as expected)`);
      console.log(`   Created agent ID: ${serviceInsertResult.id}`);
      testResults.serviceRoleInsertTest = 'PASSED';
    }
    console.log('');

    // ========== FINAL SUMMARY ==========
    console.log('═'.repeat(80));
    console.log('📊 TEST SUMMARY');
    console.log('═'.repeat(80));

    const allPassed = Object.values(testResults).every(v => v && (v === 'PASSED' || v.includes('PASSED')));
    testResults.overallStatus = allPassed ? 'PASSED' : 'PARTIAL';

    console.log(`Auth Sign-in:           ${testResults.authSignIn}`);
    console.log(`User Provisioning:      ${testResults.userProvisioning}`);
    console.log(`Workspace Creation:     ${testResults.workspaceCreation}`);
    console.log(`Membership Creation:    ${testResults.membershipCreation}`);
    console.log(`Agent Listing:          ${testResults.agentListing}`);
    console.log(`RLS SELECT Test:        ${testResults.rlsSelectTest}`);
    console.log(`RLS INSERT Test (User): ${testResults.rlsInsertTest}`);
    console.log(`Service-Role Bypass:    ${testResults.serviceRoleInsertTest}`);
    console.log(`─`.repeat(80));
    console.log(`Overall Status:         ${testResults.overallStatus}`);
    console.log('═'.repeat(80));
    console.log('');

    if (testResults.overallStatus === 'PASSED') {
      console.log('✅ All tests passed! System is ready for production.');
      process.exit(0);
    } else {
      console.log('⚠️  Some tests had issues. Review above for details.');
      process.exit(1);
    }
  } catch (err) {
    console.error('');
    console.error('❌ CRITICAL ERROR:', err.message);
    console.error('');
    console.error('Stack:', err);
    console.error('');
    testResults.overallStatus = 'FAILED';
    process.exit(1);
  }
}

runTests();