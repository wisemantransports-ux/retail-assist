#!/usr/bin/env node

import { request as httpRequest } from 'http';
import { createClient } from '@supabase/supabase-js';
import jwtlib from 'jsonwebtoken';
import * as dotenv from 'dotenv';
import { randomBytes, randomUUID } from 'crypto';

// Load environment variables
dotenv.config({ path: '.env.local' });

/**
 * Create an admin Supabase client using service-role key
 */
function createAdminSupabaseClient() {
  const url = process.env.SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url || !serviceRoleKey) {
    throw new Error(
      'Missing required environment variables:\n' +
      '  - SUPABASE_URL\n' +
      '  - SUPABASE_SERVICE_ROLE_KEY\n' +
      'Please set these in your .env.local file'
    );
  }

  return createClient(url, serviceRoleKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });
}

interface TestResult {
  step: string;
  status: 'success' | 'failed';
  message: string;
  data?: any;
  error?: string;
}

interface InviteCreateResponse {
  success: boolean;
  message: string;
  invite: {
    id: string;
    token: string;
    email: string;
  };
}

interface InviteAcceptResponse {
  success: boolean;
  user_id: string;
  workspace_id: string | null;
  role: string;
  message: string;
  error?: string;
}

/**
 * Generate an in-memory JWT to simulate authenticated user
 * Uses hardcoded secret matching development setup
 */
function generateTestJWT(userId: string, email: string): string {
  const secret = process.env.NEXT_PUBLIC_SUPABASE_JWT_SECRET || 'super-secret-jwt-token-with-at-least-32-characters-long';
  
  const now = Math.floor(Date.now() / 1000);
  const payload = {
    iss: 'https://supabase.co',
    sub: userId,
    aud: 'authenticated',
    email: email,
    email_verified: true,
    phone_verified: false,
    app_metadata: {
      provider: 'email',
      providers: ['email'],
    },
    user_metadata: {},
    iat: now,
    exp: now + 3600, // 1 hour
  };

  // Generate JWT without logging it
  const token = jwtlib.sign(payload, secret, { algorithm: 'HS256' });
  return token;
}

/**
 * Generate a random email for testing
 */
function generateTestEmail(): string {
  const timestamp = Date.now();
  const random = Math.random().toString(36).substring(2, 8);
  return `test-employee-${timestamp}-${random}@retail-assist.test`;
}

/**
 * Make HTTP request
 */
function makeRequest(
  hostname: string,
  port: number,
  path: string,
  method: string,
  body?: any,
  headers?: Record<string, string>
): Promise<{ status: number; body: string; headers: Record<string, any> }> {
  return new Promise((resolve, reject) => {
    const bodyStr = body ? JSON.stringify(body) : undefined;

    const options = {
      hostname,
      port,
      path,
      method,
      headers: {
        'Content-Type': 'application/json',
        ...(bodyStr && { 'Content-Length': Buffer.byteLength(bodyStr) }),
        ...headers,
      },
    };

    const request = httpRequest(options, (res) => {
      let data = '';

      res.on('data', (chunk) => {
        data += chunk;
      });

      res.on('end', () => {
        resolve({
          status: res.statusCode || 500,
          body: data,
          headers: res.headers as Record<string, any>,
        });
      });
    });

    request.on('error', (e) => {
      reject(e);
    });

    if (bodyStr) {
      request.write(bodyStr);
    }

    request.end();
  });
}

/**
 * Step 1: Create a temporary super_admin user for testing
 */
async function createTemporarySuperAdmin(): Promise<TestResult & { superAdminId?: string; token?: string }> {
  try {
    console.log('\n👤 Step 1: Promoting existing user to temporary super_admin...');
    
    const admin = createAdminSupabaseClient();
    
    // Find an existing user with valid auth_uid to promote
    // Use sam@demo.com which is known to exist in both auth and database
    const { data: existingUsers, error: findError } = await admin
      .from('users')
      .select('id, email, auth_uid, role, workspace_id')
      .eq('email', 'sam@demo.com')
      .single();

    if (findError || !existingUsers) {
      throw new Error(`User lookup failed: ${findError?.message || 'sam@demo.com not found'}`);
    }

    const userToPromote = existingUsers;
    const originalRole = userToPromote.role;
    const originalWorkspace = userToPromote.workspace_id;
    
    console.log(`   ✓ Found user: ${userToPromote.email}`);
    console.log(`   ✓ Original role: ${originalRole}, workspace: ${originalWorkspace || 'NULL'}`);
    
    // Promote to temporary super_admin with workspace_id = NULL (platform level)
    const { data: updated, error: updateError } = await admin
      .from('users')
      .update({
        role: 'super_admin',
        workspace_id: null, // CRITICAL: Super admin must have NULL workspace
      })
      .eq('id', userToPromote.id)
      .select('id, auth_uid')
      .single();

    if (updateError || !updated) {
      throw new Error(`Failed to promote user: ${updateError?.message}`);
    }

    console.log(`   ✓ Promoted to super_admin with workspace_id = NULL`);
    
    // Generate a proper JWT for this user using the Supabase secret
    console.log(`   ✓ Generating JWT for super_admin...`);
    const secret = process.env.NEXT_PUBLIC_SUPABASE_JWT_SECRET;
    if (!secret) {
      throw new Error('Missing NEXT_PUBLIC_SUPABASE_JWT_SECRET');
    }

    const now = Math.floor(Date.now() / 1000);
    const payload = {
      iss: 'https://supabase.co',
      sub: userToPromote.auth_uid,  // Use the actual auth_uid
      aud: 'authenticated',
      email: userToPromote.email,
      email_verified: true,
      app_metadata: { provider: 'email', providers: ['email'] },
      user_metadata: {},
      iat: now,
      exp: now + 3600,
    };

    const realToken = jwtlib.sign(payload, secret, { algorithm: 'HS256' });
    console.log(`   ✓ JWT obtained (length: ${realToken.length})`);
    console.log(`   ✅ Temporary super admin ready`);

    return {
      step: 'Create Temporary Super Admin',
      status: 'success',
      message: 'Temporary super admin created',
      superAdminId: userToPromote.id,
      token: realToken,
      data: { 
        internalId: userToPromote.id,
        // Store original state for cleanup
        originalRole,
        originalWorkspace,
        email: userToPromote.email,
      },
    };
  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : String(error);
    console.log(`   ❌ Error: ${errorMsg}`);
    return {
      step: 'Create Temporary Super Admin',
      status: 'failed',
      message: `Exception: ${errorMsg}`,
      error: errorMsg,
    };
  }
}

/**
 * Step 2: Create invite via /api/platform-employees using admin privileges
 */
async function createInvite(
  email: string,
  superAdminToken: string,
  superAdminId: string
): Promise<TestResult & { invite?: { id: string; token: string; email: string } }> {
  try {
    console.log('\n📧 Step 2: Creating employee invite...');
    console.log(`   Email: ${email}`);

    // Use admin client with service-role key to create the invite directly
    const admin = createAdminSupabaseClient();
    
    const inviteToken = randomBytes(32).toString('hex');
    const inviteId = randomUUID();
    
    const { data: createdInvite, error: createError } = await admin
      .from('employee_invites')
      .insert({
        id: inviteId,
        email,
        token: inviteToken,
        invited_by: superAdminId,
        workspace_id: null, // Platform-level invite
        created_at: new Date().toISOString(),
      })
      .select('id, email, token')
      .single();

    if (createError || !createdInvite) {
      console.log(`   ❌ Failed: ${createError?.message}`);
      return {
        step: 'Create Invite',
        status: 'failed',
        message: `Database error: ${createError?.message}`,
        error: createError?.message,
      };
    }

    console.log(`   ✅ Invite created`);
    console.log(`   ✓ Invite ID: ${createdInvite.id}`);
    console.log(`   ✓ Token: ${createdInvite.token.substring(0, 16)}...`);

    return {
      step: 'Create Invite',
      status: 'success',
      message: 'Invite created successfully',
      invite: {
        id: createdInvite.id,
        email: createdInvite.email,
        token: createdInvite.token,
      },
    };
  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : String(error);
    const fullError = error instanceof Error ? error.stack : String(error);
    console.log(`   ❌ Error: ${errorMsg}`);
    if (fullError && fullError.includes('ECONNREFUSED')) {
      console.log(`   ⚠️  Dev server not running on localhost:3000`);
      console.log(`   ℹ️  Run: npm run dev`);
    }
    return {
      step: 'Create Invite',
      status: 'failed',
      message: `Exception: ${errorMsg}`,
      error: errorMsg,
    };
  }
}

/**
 * Step 3: Verify token in database
 */
async function verifyTokenInDatabase(
  inviteId: string,
  expectedToken: string
): Promise<TestResult> {
  try {
    console.log('\n🔍 Step 3: Verifying token in database...');

    const admin = createAdminSupabaseClient();
    const { data: invite, error } = await admin
      .from('employee_invites')
      .select('id, token, status, email')
      .eq('id', inviteId)
      .single();

    if (error || !invite) {
      console.log(`   ❌ Failed to query database: ${error?.message}`);
      return {
        step: 'Verify Token in Database',
        status: 'failed',
        message: `Database error: ${error?.message}`,
        error: error?.message,
      };
    }

    const tokenMatch = invite.token === expectedToken;

    console.log(`   ✓ Invite found in database`);
    console.log(`   ✓ Token: ${invite.token.substring(0, 16)}...`);
    console.log(`   ✓ Status: ${invite.status}`);
    console.log(`   ✓ Email: ${invite.email}`);

    if (!tokenMatch) {
      console.log(`   ❌ Token mismatch!`);
      console.log(`      Expected: ${expectedToken}`);
      console.log(`      Got: ${invite.token}`);
      return {
        step: 'Verify Token in Database',
        status: 'failed',
        message: 'Token mismatch between response and database',
        data: invite,
      };
    }

    console.log(`   ✅ Token matches!`);

    return {
      step: 'Verify Token in Database',
      status: 'success',
      message: 'Token verified in database',
      data: invite,
    };
  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : String(error);
    console.log(`   ❌ Error: ${errorMsg}`);
    return {
      step: 'Verify Token in Database',
      status: 'failed',
      message: `Exception: ${errorMsg}`,
      error: errorMsg,
    };
  }
}

/**
 * Step 4: Accept invite via /api/employees/accept-invite with JWT
 */
async function acceptInvite(
  token: string,
  email: string,
  generatedJWT: string
): Promise<TestResult & { user?: { id: string; workspace_id: string | null } }> {
  try {
    console.log('\n✅ Step 4: Accepting invite...');
    console.log(`   Token: ${token.substring(0, 16)}...`);
    console.log(`   Email: ${email}`);

    const response = await makeRequest(
      'localhost',
      3000,
      `/api/employees/accept-invite?token=${encodeURIComponent(token)}`,
      'POST',
      {
        email,
        first_name: 'Test',
        last_name: 'Employee',
        password: 'TestPassword123!', // Required by the API
      },
      {
        'Authorization': `Bearer ${generatedJWT}`,
      }
    );

    if (response.status !== 200) {
      console.log(`   ❌ Failed (${response.status}): ${response.body}`);
      return {
        step: 'Accept Invite',
        status: 'failed',
        message: `HTTP ${response.status}: ${response.body}`,
        error: response.body,
      };
    }

    const data: InviteAcceptResponse = JSON.parse(response.body);

    if (!data.success) {
      console.log(`   ❌ Invalid response: ${response.body}`);
      return {
        step: 'Accept Invite',
        status: 'failed',
        message: 'Accept failed',
        error: response.body,
      };
    }

    console.log(`   ✅ Invite accepted`);
    if (data.user_id) {
      console.log(`   ✓ User ID: ${data.user_id}`);
    }
    if (data.role) {
      console.log(`   ✓ Role: ${data.role}`);
    }
    if (data.workspace_id) {
      console.log(`   ✓ Workspace ID: ${data.workspace_id}`);
    }

    return {
      step: 'Accept Invite',
      status: 'success',
      message: 'Invite accepted successfully',
      data: data,
      user: {
        id: data.user_id,
        workspace_id: data.workspace_id,
      },
    };
  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : String(error);
    console.log(`   ❌ Error: ${errorMsg}`);
    return {
      step: 'Accept Invite',
      status: 'failed',
      message: `Exception: ${errorMsg}`,
      error: errorMsg,
    };
  }
}

/**
 * Step 5: Verify user in Supabase auth.users
 */
async function verifyAuthUser(email: string): Promise<TestResult & { authUser?: { id: string } }> {
  try {
    console.log('\n🔐 Step 5: Verifying Supabase auth user...');
    console.log(`   Email: ${email}`);

    const admin = createAdminSupabaseClient();
    const { data: users, error } = await admin.auth.admin.listUsers();

    if (error) {
      console.log(`   ❌ Failed to query auth.users: ${error.message}`);
      return {
        step: 'Verify Auth User',
        status: 'failed',
        message: `Auth query error: ${error.message}`,
        error: error.message,
      };
    }

    const authUser = users?.users?.find((u: any) => u.email === email);

    if (!authUser) {
      console.log(`   ❌ User not found in auth.users`);
      return {
        step: 'Verify Auth User',
        status: 'failed',
        message: 'User not found in auth.users',
      };
    }

    console.log(`   ✅ User found in auth.users`);
    console.log(`   ✓ Auth UID: ${authUser.id}`);
    console.log(`   ✓ Email: ${authUser.email}`);
    console.log(`   ✓ Email Verified: ${authUser.email_confirmed_at ? 'Yes' : 'No'}`);

    return {
      step: 'Verify Auth User',
      status: 'success',
      message: 'User verified in auth.users',
      data: authUser,
      authUser: { id: authUser.id },
    };
  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : String(error);
    console.log(`   ❌ Error: ${errorMsg}`);
    return {
      step: 'Verify Auth User',
      status: 'failed',
      message: `Exception: ${errorMsg}`,
      error: errorMsg,
    };
  }
}

/**
 * Step 6: Verify user in internal users table
 */
async function verifyInternalUser(
  authUid: string,
  email: string
): Promise<TestResult & { internalUser?: { id: string; auth_uid: string } }> {
  try {
    console.log('\n📋 Step 6: Verifying internal user...');
    console.log(`   Auth UID: ${authUid}`);
    console.log(`   Email: ${email}`);

    const admin = createAdminSupabaseClient();
    const { data: user, error } = await admin
      .from('users')
      .select('id, auth_uid, email, role, workspace_id')
      .eq('auth_uid', authUid)
      .single();

    if (error || !user) {
      console.log(`   ❌ Failed to find user: ${error?.message}`);
      return {
        step: 'Verify Internal User',
        status: 'failed',
        message: `Database error: ${error?.message}`,
        error: error?.message,
      };
    }

    console.log(`   ✅ User found in internal users table`);
    console.log(`   ✓ User ID: ${user.id}`);
    console.log(`   ✓ Auth UID: ${user.auth_uid}`);
    console.log(`   ✓ Email: ${user.email}`);
    console.log(`   ✓ Role: ${user.role}`);
    console.log(`   ✓ Workspace ID: ${user.workspace_id || 'null (platform-level)'}`);

    return {
      step: 'Verify Internal User',
      status: 'success',
      message: 'User verified in internal users table',
      data: user,
      internalUser: {
        id: user.id,
        auth_uid: user.auth_uid,
      },
    };
  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : String(error);
    console.log(`   ❌ Error: ${errorMsg}`);
    return {
      step: 'Verify Internal User',
      status: 'failed',
      message: `Exception: ${errorMsg}`,
      error: errorMsg,
    };
  }
}

/**
 * Step 7: Clean up test data
 */
async function cleanupTestData(
  email: string,
  authUid?: string,
  internalUserId?: string,
  superAdminInternalId?: string,
  originalSuperAdminRole?: string,
  originalSuperAdminWorkspace?: string | null
): Promise<TestResult> {
  try {
    console.log('\n🧹 Step 7: Cleaning up test data...');

    const admin = createAdminSupabaseClient();
    const errors: string[] = [];

    // Delete invites
    console.log('   • Deleting invites...');
    const { error: inviteError } = await admin
      .from('employee_invites')
      .delete()
      .eq('email', email);

    if (inviteError) {
      errors.push(`Invite deletion: ${inviteError.message}`);
    } else {
      console.log('     ✓ Invites deleted');
    }

    // Delete internal user
    if (internalUserId) {
      console.log('   • Deleting internal user...');
      const { error: userError } = await admin
        .from('users')
        .delete()
        .eq('id', internalUserId);

      if (userError) {
        errors.push(`User deletion: ${userError.message}`);
      } else {
        console.log('     ✓ Internal user deleted');
      }
    }

    // Delete auth user
    if (authUid) {
      console.log('   • Deleting auth user...');
      const { error: authError } = await admin.auth.admin.deleteUser(authUid);

      if (authError) {
        errors.push(`Auth deletion: ${authError.message}`);
      } else {
        console.log('     ✓ Auth user deleted');
      }
    }

    // Restore temporary super_admin to original role
    if (superAdminInternalId && originalSuperAdminRole) {
      console.log('   • Restoring temporary super_admin to original role...');
      const { error: restoreError } = await admin
        .from('users')
        .update({
          role: originalSuperAdminRole,
          workspace_id: originalSuperAdminWorkspace === undefined ? null : originalSuperAdminWorkspace,
        })
        .eq('id', superAdminInternalId);

      if (restoreError) {
        errors.push(`Super admin restore: ${restoreError.message}`);
      } else {
        console.log(`     ✓ Super admin restored to role: ${originalSuperAdminRole}`);
      }
    }

    if (errors.length > 0) {
      console.log(`   ⚠️  Some cleanup steps failed:`);
      errors.forEach((err) => console.log(`      - ${err}`));
      return {
        step: 'Cleanup',
        status: 'failed',
        message: `Partial cleanup: ${errors.join('; ')}`,
      };
    }

    console.log(`   ✅ Cleanup completed`);
    return {
      step: 'Cleanup',
      status: 'success',
      message: 'All test data cleaned up successfully',
    };
  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : String(error);
    console.log(`   ❌ Error: ${errorMsg}`);
    return {
      step: 'Cleanup',
      status: 'failed',
      message: `Exception: ${errorMsg}`,
      error: errorMsg,
    };
  }
}

/**
 * Main test execution
 */
async function runTests() {
  console.log('🚀 Starting Retail-Assist Employee Invite Flow Test\n');
  console.log('═'.repeat(60));

  const testEmail = generateTestEmail();
  const results: TestResult[] = [];

  let inviteToken: string | null = null;
  let inviteId: string | null = null;
  let authUid: string | null = null;
  let internalUserId: string | null = null;
  let superAdminId: string | null = null;
  let superAdminJWT: string | null = null;
  let originalSuperAdminRole: string | null = null;
  let originalSuperAdminWorkspace: string | null | undefined = null;

  try {
    // Step 1: Create temporary super_admin user
    const superAdminResult = await createTemporarySuperAdmin();
    results.push(superAdminResult);

    if (superAdminResult.status === 'success' && superAdminResult.data) {
      superAdminId = superAdminResult.data.internalId;
      
      // Store original state for restoration during cleanup
      originalSuperAdminRole = superAdminResult.data.originalRole;
      originalSuperAdminWorkspace = superAdminResult.data.originalWorkspace;
      
      // Use the real JWT token from Supabase authentication
      superAdminJWT = (superAdminResult as any).token;
      
      if (!superAdminJWT) {
        throw new Error('No JWT token returned from super admin authentication');
      }

      // Step 2: Create Invite using super_admin JWT
      const createResult = await createInvite(testEmail, superAdminJWT, superAdminId);
      results.push(createResult);

      if (createResult.status === 'success' && createResult.invite) {
        inviteToken = createResult.invite.token;
        inviteId = createResult.invite.id;

        // Step 3: Verify Token in Database
        const verifyResult = await verifyTokenInDatabase(inviteId, inviteToken);
        results.push(verifyResult);

        // Create JWT for the employee who will accept the invite
        const employeeJWT = generateTestJWT(randomUUID(), testEmail);
        console.log(`\n📝 Generated JWT for employee (length: ${employeeJWT.length})`);

        // Step 4: Accept Invite using employee JWT
        const acceptResult = await acceptInvite(inviteToken, testEmail, employeeJWT);
        results.push(acceptResult);

        if (acceptResult.status === 'success' && acceptResult.user) {
          internalUserId = acceptResult.user.id;

          // Step 5: Verify Auth User
          const authResult = await verifyAuthUser(testEmail);
          results.push(authResult);

          if (authResult.status === 'success' && authResult.authUser) {
            authUid = authResult.authUser.id;

            // Step 6: Verify Internal User
            const internalResult = await verifyInternalUser(authUid, testEmail);
            results.push(internalResult);
          }
        }
      }
    }
  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : String(error);
    console.error(`\n❌ Fatal error: ${errorMsg}`);
    results.push({
      step: 'Setup',
      status: 'failed',
      message: errorMsg,
      error: errorMsg,
    });
  }

  // Step 7: Cleanup (including restoring temporary super_admin)
  const cleanupResult = await cleanupTestData(
    testEmail,
    authUid || undefined,
    internalUserId || undefined,
    superAdminId || undefined,
    originalSuperAdminRole || undefined,
    originalSuperAdminWorkspace
  );
  results.push(cleanupResult);

  // Clear sensitive data from memory
  if (superAdminJWT) {
    superAdminJWT = null as any; // Explicitly clear
  }

  // Print summary
  console.log('\n' + '═'.repeat(60));
  console.log('\n📊 TEST SUMMARY\n');

  const successful = results.filter((r) => r.status === 'success').length;
  const failed = results.filter((r) => r.status === 'failed').length;

  // Print results as table
  console.log('┌─────────────────────────────────────┬─────────┐');
  console.log('│ Step                                │ Status  │');
  console.log('├─────────────────────────────────────┼─────────┤');
  
  results.forEach((result) => {
    const status = result.status === 'success' ? '✅ PASS' : '❌ FAIL';
    const step = result.step.padEnd(35);
    console.log(`│ ${step} │ ${status.padEnd(7)} │`);
  });
  
  console.log('└─────────────────────────────────────┴─────────┘');
  console.log();
  console.log(`Success: ${successful} / ${results.length}`);
  console.log(`Failures: ${failed}`);
  console.log(`Status: ${failed === 0 ? '✅ PASS' : '❌ FAIL'}`);

  if (failed === 0) {
    console.log('\n🎉 All tests passed!');
    process.exit(0);
  } else {
    console.log('\n⚠️  Some tests failed. See details above.');
    process.exit(1);
  }
}

// Run tests
runTests().catch((error) => {
  console.error('Unexpected error:', error);
  process.exit(1);
});
