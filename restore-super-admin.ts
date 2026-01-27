#!/usr/bin/env node

import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });

const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;

if (!serviceRoleKey || !supabaseUrl) {
  console.error('❌ Missing required environment variables');
  process.exit(1);
}

const admin = createClient(supabaseUrl, serviceRoleKey);

interface RestorationStatus {
  timestamp: string;
  userEmail: string;
  authUid?: string;
  actions: {
    step: string;
    status: 'success' | 'failed' | 'skipped';
    message: string;
    details?: any;
  }[];
}

async function restoreSuperAdmin(): Promise<void> {
  console.log('\n🔐 SUPER ADMIN RESTORATION PROCESS');
  console.log('═'.repeat(60));

  const status: RestorationStatus = {
    timestamp: new Date().toISOString(),
    userEmail: 'sam@demo.com',
    actions: [],
  };

  try {
    // Step 1: Find the user in the database
    console.log('\n📍 Step 1: Locating super_admin account (sam@demo.com)...');
    const { data: users, error: findError } = await admin
      .from('users')
      .select('id, email, auth_uid, role, workspace_id')
      .eq('email', 'sam@demo.com');

    if (findError || !users || users.length === 0) {
      console.log('❌ User not found');
      status.actions.push({
        step: 'Find User',
        status: 'failed',
        message: `Could not locate sam@demo.com: ${findError?.message}`,
      });
      throw new Error('User not found');
    }

    const user = users[0];
    status.authUid = user.auth_uid;

    console.log(`   ✓ Found user: ${user.email}`);
    console.log(`   ✓ Current role: ${user.role}`);
    console.log(`   ✓ Current workspace_id: ${user.workspace_id || 'NULL (platform-level)'}`);
    console.log(`   ✓ Auth UID: ${user.auth_uid.substring(0, 8)}...`);

    status.actions.push({
      step: 'Find User',
      status: 'success',
      message: `Located sam@demo.com with auth_uid: ${user.auth_uid}`,
      details: { role: user.role, workspace_id: user.workspace_id },
    });

    // Step 2: Verify role is super_admin
    console.log('\n🔍 Step 2: Verifying super_admin status...');
    if (user.role === 'super_admin' && user.workspace_id === null) {
      console.log('   ✓ User is already a super_admin with workspace_id = NULL');
      console.log('   ✓ Role assignment is correct');
      status.actions.push({
        step: 'Verify Role',
        status: 'success',
        message: 'User role is already correct (super_admin)',
      });
    } else {
      console.log('   ⚠️  Role mismatch detected');
      console.log(`   • Expected: super_admin with workspace_id = NULL`);
      console.log(`   • Actual: ${user.role} with workspace_id = ${user.workspace_id || 'NULL'}`);

      console.log('\n   🔧 Correcting role assignment...');
      const { data: updated, error: updateError } = await admin
        .from('users')
        .update({
          role: 'super_admin',
          workspace_id: null,
        })
        .eq('id', user.id)
        .select('id, role, workspace_id')
        .single();

      if (updateError || !updated) {
        console.log(`   ❌ Failed to restore role: ${updateError?.message}`);
        status.actions.push({
          step: 'Restore Role',
          status: 'failed',
          message: `Failed to restore role: ${updateError?.message}`,
        });
        throw new Error('Role restoration failed');
      }

      console.log('   ✓ Role restored to: super_admin');
      console.log('   ✓ Workspace ID set to: NULL (platform-level)');
      status.actions.push({
        step: 'Restore Role',
        status: 'success',
        message: 'Role restored to super_admin with workspace_id = NULL',
      });
    }

    // Step 3: Query auth.sessions for this user
    console.log('\n🧹 Step 3: Checking for temporary sessions and tokens...');
    const { data: sessions, error: sessionError } = await admin
      .from('sessions')
      .select('id, user_id, created_at, updated_at')
      .eq('user_id', user.auth_uid);

    if (sessionError) {
      console.log(`   ⚠️  Could not query sessions: ${sessionError.message}`);
      status.actions.push({
        step: 'Query Sessions',
        status: 'skipped',
        message: `Session query skipped: ${sessionError.message}`,
      });
    } else if (!sessions || sessions.length === 0) {
      console.log('   ✓ No temporary sessions found');
      status.actions.push({
        step: 'Query Sessions',
        status: 'success',
        message: 'No temporary sessions to clean up',
      });
    } else {
      console.log(`   ℹ️  Found ${sessions.length} session(s)`);
      sessions.forEach((session, index) => {
        console.log(`      • Session ${index + 1}: ${session.id.substring(0, 8)}...`);
        console.log(`        Created: ${new Date(session.created_at).toLocaleString()}`);
      });

      // Note: We don't delete sessions as they're part of normal auth flow
      console.log('   ℹ️  Note: Sessions are managed by Supabase auth lifecycle');
      console.log('   ℹ️  They will expire automatically (default: 1 hour)');

      status.actions.push({
        step: 'Query Sessions',
        status: 'success',
        message: `Found ${sessions.length} session(s) - will expire naturally`,
      });
    }

    // Step 4: Verify workspace associations
    console.log('\n📊 Step 4: Verifying workspace associations...');
    const { data: workspaces, error: wsError } = await admin
      .from('workspaces')
      .select('id, name, owner_id, created_at')
      .eq('owner_id', user.id);

    if (wsError) {
      console.log(`   ⚠️  Could not query workspaces: ${wsError.message}`);
      status.actions.push({
        step: 'Verify Workspaces',
        status: 'skipped',
        message: `Workspace query skipped: ${wsError.message}`,
      });
    } else if (!workspaces || workspaces.length === 0) {
      console.log('   ✓ No workspaces owned by this user');
      status.actions.push({
        step: 'Verify Workspaces',
        status: 'success',
        message: 'No workspace ownership conflicts',
      });
    } else {
      console.log(`   ✓ User owns ${workspaces.length} workspace(s):`);
      workspaces.forEach((ws) => {
        console.log(`      • ${ws.name} (ID: ${ws.id.substring(0, 8)}...)`);
      });
      status.actions.push({
        step: 'Verify Workspaces',
        status: 'success',
        message: `User owns ${workspaces.length} workspace(s)`,
      });
    }

    // Step 5: Verify auth user status
    console.log('\n🔐 Step 5: Verifying Supabase auth user status...');
    const { data: authData, error: authError } = await admin.auth.admin.listUsers();

    if (authError) {
      console.log(`   ⚠️  Could not query auth users: ${authError.message}`);
      status.actions.push({
        step: 'Verify Auth User',
        status: 'skipped',
        message: `Auth query skipped: ${authError.message}`,
      });
    } else {
      const authUsers = authData?.users || [];
      const authUser = authUsers.find((u: any) => u.id === user.auth_uid);
      if (!authUser) {
        console.log('   ⚠️  Auth user not found (unexpected)');
        status.actions.push({
          step: 'Verify Auth User',
          status: 'failed',
          message: 'Auth user not found in Supabase auth system',
        });
      } else {
        console.log('   ✓ Auth user exists in Supabase');
        console.log(`   ✓ Email: ${authUser.email}`);
        console.log(`   ✓ Email verified: ${authUser.email_confirmed_at ? 'Yes' : 'No'}`);
        console.log(`   ✓ Created: ${new Date(authUser.created_at).toLocaleString()}`);

        status.actions.push({
          step: 'Verify Auth User',
          status: 'success',
          message: `Auth user verified: ${authUser.email}`,
          details: {
            email_verified: !!authUser.email_confirmed_at,
            created_at: authUser.created_at,
          },
        });
      }
    }

    // Step 6: Final verification
    console.log('\n✅ Step 6: Final verification of restored state...');
    const { data: finalUser, error: finalError } = await admin
      .from('users')
      .select('id, email, role, workspace_id, created_at, updated_at')
      .eq('email', 'sam@demo.com')
      .single();

    if (finalError || !finalUser) {
      console.log(`   ❌ Final verification failed: ${finalError?.message}`);
      status.actions.push({
        step: 'Final Verification',
        status: 'failed',
        message: `Could not verify final state: ${finalError?.message}`,
      });
      throw new Error('Final verification failed');
    }

    console.log('   ✓ Database state verified:');
    console.log(`      • Email: ${finalUser.email}`);
    console.log(`      • Role: ${finalUser.role}`);
    console.log(`      • Workspace ID: ${finalUser.workspace_id || 'NULL (platform-level)'}`);
    console.log(`      • Created: ${new Date(finalUser.created_at).toLocaleString()}`);
    console.log(`      • Last Updated: ${new Date(finalUser.updated_at).toLocaleString()}`);

    status.actions.push({
      step: 'Final Verification',
      status: 'success',
      message: 'Super admin account fully restored',
      details: {
        email: finalUser.email,
        role: finalUser.role,
        workspace_id: finalUser.workspace_id,
      },
    });

    // Print summary
    console.log('\n' + '═'.repeat(60));
    console.log('\n📋 RESTORATION SUMMARY\n');

    const successCount = status.actions.filter((a) => a.status === 'success').length;
    const failedCount = status.actions.filter((a) => a.status === 'failed').length;
    const skippedCount = status.actions.filter((a) => a.status === 'skipped').length;

    console.log('┌─────────────────────────────────────┬──────────┐');
    console.log('│ Step                                │ Status   │');
    console.log('├─────────────────────────────────────┼──────────┤');

    status.actions.forEach((action) => {
      const statusIcon = action.status === 'success' ? '✅' : action.status === 'failed' ? '❌' : '⏭️ ';
      const padding = ' '.repeat(Math.max(0, 35 - action.step.length));
      console.log(`│ ${action.step}${padding}│ ${statusIcon} ${action.status.toUpperCase().padEnd(6)} │`);
    });

    console.log('└─────────────────────────────────────┴──────────┘');

    console.log(`\nSuccessful: ${successCount}`);
    console.log(`Failed: ${failedCount}`);
    console.log(`Skipped: ${skippedCount}`);

    if (failedCount === 0) {
      console.log('\n✅ RESTORATION COMPLETE - All critical steps passed');
      console.log('\n🎯 Super admin account status:');
      console.log(`   • Email: sam@demo.com`);
      console.log(`   • Role: super_admin`);
      console.log(`   • Access Level: Platform-wide (workspace_id = NULL)`);
      console.log(`   • Login: Ready (can log in via normal Supabase flow)`);
      console.log(`   • Sessions: Will expire naturally`);
      console.log('\n✨ Account is fully restored and ready for use\n');
    } else {
      console.log('\n⚠️  RESTORATION INCOMPLETE - Some steps failed');
      console.log('   Please review the failures above and take corrective action\n');
      process.exit(1);
    }
  } catch (error) {
    console.error('\n❌ RESTORATION FAILED');
    const errorMsg = error instanceof Error ? error.message : String(error);
    console.error(`   Error: ${errorMsg}\n`);
    process.exit(1);
  }
}

// Run restoration
restoreSuperAdmin().catch((error) => {
  console.error('Unexpected error:', error);
  process.exit(1);
});
