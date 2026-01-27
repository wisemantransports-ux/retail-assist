/**
 * V1 Auth - Invite Acceptance Flow Test
 * =====================================
 * 
 * Tests the complete flow from invite acceptance through successful login.
 * 
 * Flow:
 * 1. Admin creates an invite → employee_invites table
 * 2. Employee accepts invite → auth_uid linked to internal user row
 * 3. Employee logs in → ensureInternalUser finds user by auth_uid
 * 4. Login resolves role and workspace → user authenticated
 * 
 * This test verifies auth_uid linkage is correct at each step.
 */

import { createClient } from '@supabase/supabase-js';
import { randomUUID } from 'crypto';
import * as fs from 'fs';
import * as path from 'path';

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const SERVICE_ROLE = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_URL || !SERVICE_ROLE || !ANON_KEY) {
  console.error('❌ Missing Supabase configuration');
  console.error('Required env vars: NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, NEXT_PUBLIC_SUPABASE_ANON_KEY');
  process.exit(1);
}

const admin = createClient(SUPABASE_URL, SERVICE_ROLE, {
  auth: { persistSession: false },
});

interface TestResult {
  step: string;
  status: 'success' | 'failure';
  message: string;
  details?: any;
}

const results: TestResult[] = [];

function logResult(step: string, status: 'success' | 'failure', message: string, details?: any) {
  const result: TestResult = { step, status, message, details };
  results.push(result);
  const icon = status === 'success' ? '✅' : '❌';
  console.log(`${icon} ${step}: ${message}`, details ? JSON.stringify(details, null, 2) : '');
}

async function testInviteAcceptanceFlow() {
  console.log('\n🚀 V1 Auth - Invite Acceptance Flow Test');
  console.log('='.repeat(50));

  const testEmail = `test-invite-${randomUUID().slice(0, 8)}@retail-assist.test`;
  const testPassword = 'TestPassword123!';
  let inviteToken: string;
  let inviteId: string;
  let authUid: string;
  let internalUserId: string;
  let adminUserId: string;
  let adminUserCreated = false;
  let workspaceId: string | null = null;

  try {
    // ============================================================
    // STEP 1: VERIFY ADMIN USER EXISTS (for invited_by requirement)
    // ============================================================
    console.log('\n📋 Step 1: Get or create admin user');
    let adminUserId: string;
    
    const adminEmail = 'dev-super-admin@retail-assist.test';
    const { data: adminUsers } = await admin
      .from('users')
      .select('id')
      .eq('email', adminEmail)
      .limit(1);

    if (adminUsers && adminUsers.length > 0) {
      adminUserId = adminUsers[0].id;
      logResult('Get admin user', 'success', 'Admin user found', { admin_user_id: adminUserId });
    } else {
      // Create admin user for testing
      const { data: newAdminUser, error: adminError } = await admin
        .from('users')
        .insert({
          email: adminEmail,
          role: 'super_admin',
          workspace_id: null,
        })
        .select('id')
        .single();

      if (adminError || !newAdminUser) {
        logResult('Create admin user', 'failure', adminError?.message || 'Unknown error');
        return results;
      }
      adminUserId = newAdminUser.id;
      adminUserCreated = true;
      logResult('Create admin user', 'success', 'Test admin user created', { admin_user_id: adminUserId });
    }

    // ============================================================
    // STEP 2: CREATE A TEST WORKSPACE
    // ============================================================
    console.log('\n📋 Step 2: Create test workspace');
    const workspace = await admin
      .from('workspaces')
      .insert({ name: 'Test Workspace', owner_id: adminUserId })
      .select()
      .single();

    if (workspace.error) {
      logResult('Create workspace', 'failure', workspace.error.message);
      workspaceId = null;
    } else {
      workspaceId = workspace.data?.id || null;
      logResult('Create workspace', 'success', 'Workspace created', { workspace_id: workspaceId });
    }

    // ============================================================
    // STEP 3: CREATE AN INVITE
    // ============================================================
    console.log('\n📋 Step 3: Create employee invite');
    inviteToken = randomUUID();
    const createInvite = await admin
      .from('employee_invites')
      .insert({
        email: testEmail,
        token: inviteToken,
        status: 'pending',
        workspace_id: workspaceId,
        invited_by: adminUserId,
      })
      .select('id')
      .single();

    if (createInvite.error) {
      logResult('Create invite', 'failure', createInvite.error.message);
      return results;
    }

    inviteId = createInvite.data.id;
    logResult('Create invite', 'success', 'Invite created', {
      invite_id: inviteId,
      token: inviteToken.slice(0, 8) + '...',
      email: testEmail,
      workspace_id: workspaceId,
      invited_by: adminUserId,
    });

    // ============================================================
    // STEP 4: CREATE INTERNAL USER ROW (simulating admin pre-creation)
    // ============================================================
    console.log('\n📋 Step 4: Create internal user row (pre-acceptance)');
    const createInternalUser = await admin
      .from('users')
      .insert({
        email: testEmail,
        role: 'employee',
        workspace_id: workspaceId,
        auth_uid: null, // Not yet linked
      })
      .select('id')
      .single();

    if (createInternalUser.error) {
      logResult('Create internal user', 'failure', createInternalUser.error.message);
      return results;
    }

    internalUserId = createInternalUser.data.id;
    logResult('Create internal user', 'success', 'Internal user row created (no auth_uid yet)', {
      user_id: internalUserId,
      email: testEmail,
      role: 'employee',
      auth_uid: null,
      workspace_id: workspaceId,
    });

    // ============================================================
    // STEP 5: CREATE SUPABASE AUTH USER (simulating accept-invite)
    // ============================================================
    console.log('\n📋 Step 5: Create Supabase auth user');
    const createAuthUser = await admin.auth.admin.createUser({
      email: testEmail,
      password: testPassword,
      email_confirm: true,
    });

    if (createAuthUser.error) {
      logResult('Create auth user', 'failure', createAuthUser.error?.message || 'Unknown error');
      return results;
    }

    authUid = createAuthUser.data.user?.id || '';
    if (!authUid) {
      logResult('Create auth user', 'failure', 'No auth_uid returned from Supabase');
      return results;
    }

    logResult('Create auth user', 'success', 'Supabase auth user created', {
      auth_uid: authUid,
      email: testEmail,
    });

    // ============================================================
    // STEP 6: LINK auth_uid TO INTERNAL USER ROW (critical!)
    // ============================================================
    console.log('\n📋 Step 6: Link auth_uid to internal user row');
    const linkAuthUid = await admin
      .from('users')
      .update({ auth_uid: authUid })
      .eq('id', internalUserId)
      .select('id, auth_uid, role, workspace_id')
      .single();

    if (linkAuthUid.error) {
      logResult('Link auth_uid', 'failure', linkAuthUid.error.message);
      return results;
    }

    logResult('Link auth_uid', 'success', '✨ auth_uid linked to internal user', {
      user_id: internalUserId,
      auth_uid: authUid,
      role: linkAuthUid.data.role,
      workspace_id: linkAuthUid.data.workspace_id,
    });

    // ============================================================
    // STEP 7: MARK INVITE AS ACCEPTED
    // ============================================================
    console.log('\n📋 Step 7: Mark invite as accepted');
    const acceptInvite = await admin
      .from('employee_invites')
      .update({
        status: 'accepted',
        accepted_at: new Date().toISOString(),
      })
      .eq('id', inviteId)
      .select()
      .single();

    if (acceptInvite.error) {
      logResult('Accept invite', 'failure', acceptInvite.error.message);
      return results;
    }

    logResult('Accept invite', 'success', 'Invite marked as accepted', {
      invite_id: inviteId,
      status: 'accepted',
    });

    // ============================================================
    // STEP 8: VERIFY USER CAN BE FOUND BY auth_uid
    // ============================================================
    console.log('\n📋 Step 8: Verify user can be found by auth_uid');
    const findByAuthUid = await admin
      .from('users')
      .select('id, auth_uid, role, workspace_id')
      .eq('auth_uid', authUid)
      .single();

    if (findByAuthUid.error) {
      logResult('Find by auth_uid', 'failure', findByAuthUid.error.message);
      return results;
    }

    if (findByAuthUid.data.id !== internalUserId) {
      logResult('Find by auth_uid', 'failure', 'User ID mismatch');
      return results;
    }

    logResult('Find by auth_uid', 'success', '✅ User found by auth_uid', {
      user_id: findByAuthUid.data.id,
      auth_uid: findByAuthUid.data.auth_uid,
      role: findByAuthUid.data.role,
      workspace_id: findByAuthUid.data.workspace_id,
    });

    // ============================================================
    // STEP 9: SIMULATE LOGIN - Get access token
    // ============================================================
    console.log('\n📋 Step 9: Simulate login with Supabase client');
    const anonClient = createClient(SUPABASE_URL, ANON_KEY);
    const loginResult = await anonClient.auth.signInWithPassword({
      email: testEmail,
      password: testPassword,
    });

    if (loginResult.error) {
      logResult('Login', 'failure', loginResult.error.message);
      return results;
    }

    if (!loginResult.data.user?.id) {
      logResult('Login', 'failure', 'No user returned from login');
      return results;
    }

    if (loginResult.data.user.id !== authUid) {
      logResult('Login', 'failure', 'Login auth_uid mismatch');
      return results;
    }

    logResult('Login', 'success', 'Login successful with correct auth_uid', {
      email: loginResult.data.user.email,
      auth_uid: loginResult.data.user.id,
    });

    // ============================================================
    // STEP 10: VERIFY USER ROLE AND WORKSPACE
    // ============================================================
    console.log('\n📋 Step 10: Verify user role and workspace are accessible');
    const verifyRole = await admin
      .from('users')
      .select('role, workspace_id')
      .eq('auth_uid', authUid)
      .single();

    if (verifyRole.error) {
      logResult('Verify role', 'failure', verifyRole.error.message);
      return results;
    }

    if (!verifyRole.data.role) {
      logResult('Verify role', 'failure', 'Role is missing!');
      return results;
    }

    logResult('Verify role', 'success', 'User role and workspace verified', {
      role: verifyRole.data.role,
      workspace_id: verifyRole.data.workspace_id,
    });

    // ============================================================
    // SUCCESS!
    // ============================================================
    console.log('\n✅ TEST SUITE PASSED');
    console.log('🎉 Invite acceptance flow works end-to-end!');
    logResult('Full flow', 'success', 'All steps completed successfully');

  } catch (error: any) {
    logResult('Unexpected error', 'failure', error.message, error);
    return results;
  } finally {
    // ============================================================
    // CLEANUP
    // ============================================================
    console.log('\n📋 Cleanup: Removing test data');

    if (authUid) {
      try {
        await admin.auth.admin.deleteUser(authUid);
        console.log('  ✅ Auth user deleted:', authUid);
      } catch (e) {
        console.log('  ⚠️  Could not delete auth user');
      }
    }
    if (internalUserId) {
      const { error: deleteUserError } = await admin
        .from('users')
        .delete()
        .eq('id', internalUserId);
      if (!deleteUserError) {
        console.log('  ✅ Internal user deleted:', internalUserId);
      }
    }

    if (inviteId) {
      const { error: deleteInviteError } = await admin
        .from('employee_invites')
        .delete()
        .eq('id', inviteId);
      if (!deleteInviteError) {
        console.log('  ✅ Invite deleted:', inviteId);
      }
    }

    if (workspaceId) {
      const { error: deleteWorkspaceError } = await admin
        .from('workspaces')
        .delete()
        .eq('id', workspaceId);
      if (!deleteWorkspaceError) {
        console.log('  ✅ Workspace deleted:', workspaceId);
      }
    }

    if (adminUserCreated && adminUserId) {
      const { error: deleteAdminError } = await admin
        .from('users')
        .delete()
        .eq('id', adminUserId);
      if (!deleteAdminError) {
        console.log('  ✅ Test admin user deleted:', adminUserId);
      }
    }
  }

  return results;
}

async function main() {
  try {
    const testResults = await testInviteAcceptanceFlow();

    // Summary
    const passed = testResults.filter(r => r.status === 'success').length;
    const failed = testResults.filter(r => r.status === 'failure').length;

    console.log('\n' + '='.repeat(50));
    console.log(`📊 TEST SUMMARY`);
    console.log(`Total: ${testResults.length} | Passed: ${passed} | Failed: ${failed}`);
    console.log('='.repeat(50));

    // Save results
    const resultsPath = path.join(process.cwd(), 'tmp', 'test-invite-acceptance-results.json');
    const resultsDir = path.dirname(resultsPath);
    if (!fs.existsSync(resultsDir)) {
      fs.mkdirSync(resultsDir, { recursive: true });
    }

    fs.writeFileSync(
      resultsPath,
      JSON.stringify(
        {
          timestamp: new Date().toISOString(),
          testResults,
          summary: { total: testResults.length, passed, failed },
        },
        null,
        2
      )
    );

    console.log(`\n📁 Results saved to: ${resultsPath}`);

    process.exit(failed > 0 ? 1 : 0);
  } catch (error) {
    console.error('❌ Fatal error:', error);
    process.exit(1);
  }
}

main();
