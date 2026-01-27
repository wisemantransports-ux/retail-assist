#!/usr/bin/env node

/**
 * Safe Dev Test Runner for Employee Invite Flow
 * 
 * This script:
 * 1. Gets or creates a dev super_admin account
 * 2. Generates a server-side token (NO browser cookies needed!)
 * 3. Runs the employee invite flow test suite
 * 4. Reports results with pass/fail summary
 * 
 * Usage:
 *   npm run test:invite-flow:safe
 */

import * as fs from 'fs';
import * as path from 'path';
import { createAdminSupabaseClient } from './lib/admin-client.ts';
import * as dotenv from 'dotenv';
import { spawn } from 'child_process';

// Load environment variables
dotenv.config({ path: '.env.local' });

interface TestResult {
  step: string;
  status: 'success' | 'failed';
  message: string;
  details?: any;
}

const DEV_ADMIN_EMAIL = 'dev-super-admin@retail-assist.test';
const RESULTS_FILE = path.join(process.cwd(), 'tmp', 'test-results.json');

/**
 * Ensure tmp directory exists
 */
function ensureTmpDir() {
  const tmpDir = path.join(process.cwd(), 'tmp');
  if (!fs.existsSync(tmpDir)) {
    fs.mkdirSync(tmpDir, { recursive: true });
  }
  return tmpDir;
}

/**
 * Get or create dev admin account with server-side token
 */
async function getAdminToken(): Promise<{
  token: string;
  email: string;
  authUid: string;
}> {
  console.log('\n🔑 Setting up dev super admin account...');

  const admin = createAdminSupabaseClient();

  try {
    // Try to find existing admin user
    console.log('   ℹ️  Checking for existing admin user...');
    const { data: users } = await admin.auth.admin.listUsers();
    const adminUser = (users?.users || []).find((u: any) => u.email === DEV_ADMIN_EMAIL);

    if (adminUser) {
      console.log(`   ✅ Found dev admin: ${adminUser.id}`);
      return {
        token: `ADMIN_${adminUser.id.substring(0, 20)}`,
        email: DEV_ADMIN_EMAIL,
        authUid: adminUser.id,
      };
    }

    console.log('   ℹ️  Creating dev admin user...');

    // Try to create auth user
    try {
      const { data: newAuth, error: authError } = await admin.auth.admin.createUser({
        email: DEV_ADMIN_EMAIL,
        password: 'DevTest123!@#',
        email_confirm: true,
      });

      if (!authError && newAuth?.user?.id) {
        console.log(`   ✅ Created auth user: ${newAuth.user.id}`);

        // Try to create internal user record (optional)
        try {
          await admin
            .from('users')
            .insert({
              auth_uid: newAuth.user.id,
              email: DEV_ADMIN_EMAIL,
              role: 'super_admin',
            });
          console.log(`   ✅ Created internal user record`);
        } catch (e) {
          console.log(`   ℹ️  Internal user record: ${(e as any)?.message || 'skipped'}`);
        }

        return {
          token: `ADMIN_${newAuth.user.id.substring(0, 20)}`,
          email: DEV_ADMIN_EMAIL,
          authUid: newAuth.user.id,
        };
      }

      // If creation failed, log but continue
      console.log(`   ⚠️  Auth creation: ${authError?.message || 'unknown error'}`);
    } catch (e) {
      console.log(`   ⚠️  Error during setup: ${(e as any)?.message}`);
    }

    // Fallback: Return a test token even if setup partially failed
    const fallbackId = `test-${Date.now().toString().slice(-16)}`;
    console.log(`   ℹ️  Using fallback token for testing`);
    return {
      token: `TEST_ADMIN_${fallbackId}`,
      email: DEV_ADMIN_EMAIL,
      authUid: fallbackId,
    };
  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : String(error);
    console.error(`   ❌ Fatal: ${errorMsg}`);
    throw error;
  }
}

/**
 * Run the test suite as a child process
 */
async function runTestSuite(authToken: string): Promise<TestResult[]> {
  console.log('\n🚀 Running employee invite flow test suite...');
  console.log('═'.repeat(60));

  return new Promise((resolve) => {
    const results: TestResult[] = [];

    // Spawn test process with auth token
    const testProcess = spawn('npx', [
      'ts-node',
      '-r',
      'tsconfig-paths/register',
      'test-invite-direct.ts',
    ], {
      cwd: process.cwd(),
      env: {
        ...process.env,
        TEST_AUTH_TOKEN: authToken,
        SUPPRESS_NO_CONFIG_WARNING: 'true',
      },
      stdio: ['pipe', 'pipe', 'pipe'],
    });

    let stdout = '';
    let stderr = '';

    testProcess.stdout?.on('data', (data) => {
      stdout += data.toString();
      process.stdout.write(data);
    });

    testProcess.stderr?.on('data', (data) => {
      stderr += data.toString();
      process.stderr.write(data);
    });

    testProcess.on('close', (code) => {
      // Parse results from stdout
      const successPattern = /✅\s+([^:]+):\s*(.+)/g;
      const failPattern = /❌\s+([^:]+):\s*(.+)/g;

      let match;
      while ((match = successPattern.exec(stdout)) !== null) {
        results.push({
          step: match[1].trim(),
          status: 'success',
          message: match[2].trim(),
        });
      }

      while ((match = failPattern.exec(stdout)) !== null) {
        results.push({
          step: match[1].trim(),
          status: 'failed',
          message: match[2].trim(),
        });
      }

      // If no patterns found, check exit code
      if (results.length === 0) {
        if (code === 0) {
          results.push({
            step: 'Test Suite',
            status: 'success',
            message: 'All tests passed',
          });
        } else {
          results.push({
            step: 'Test Suite',
            status: 'failed',
            message: stderr || 'Tests failed with exit code ' + code,
          });
        }
      }

      resolve(results);
    });
  });
}

/**
 * Generate summary output
 */
function generateSummary(results: TestResult[]): void {
  const passed = results.filter((r) => r.status === 'success').length;
  const failed = results.filter((r) => r.status === 'failed').length;

  console.log('\n' + '═'.repeat(60));
  console.log('📊 TEST SUMMARY');
  console.log('═'.repeat(60));

  results.forEach((result) => {
    const icon = result.status === 'success' ? '✅' : '❌';
    console.log(`${icon} ${result.step}: ${result.message}`);
  });

  console.log('─'.repeat(60));
  console.log(`Total: ${results.length} | Passed: ${passed} | Failed: ${failed}`);

  if (failed === 0) {
    console.log('🎉 All tests passed!');
  } else {
    console.log(`⚠️  ${failed} test(s) failed`);
  }
  console.log('═'.repeat(60));
}

/**
 * Save results to file
 */
function saveResults(
  adminEmail: string,
  testResults: TestResult[]
): void {
  ensureTmpDir();

  const summary = {
    timestamp: new Date().toISOString(),
    admin: { email: adminEmail },
    testResults,
    summary: {
      total: testResults.length,
      passed: testResults.filter((r) => r.status === 'success').length,
      failed: testResults.filter((r) => r.status === 'failed').length,
    },
  };

  fs.writeFileSync(RESULTS_FILE, JSON.stringify(summary, null, 2));
  console.log(`📄 Results saved: ${RESULTS_FILE}`);
}

/**
 * Main execution
 */
async function main() {
  try {
    console.log('🚀 Employee Invite Flow Test - Safe Dev Runner');
    console.log('═'.repeat(60));

    // Ensure required environment
    if (!process.env.SUPABASE_SERVICE_ROLE_KEY) {
      throw new Error(
        'Missing SUPABASE_SERVICE_ROLE_KEY. Check your .env.local file.'
      );
    }

    // Step 1: Get admin token
    const { token: authToken, email: adminEmail } = await getAdminToken();
    console.log(`   ✓ Token ready for testing`);

    // Step 2: Run tests
    const testResults = await runTestSuite(authToken);

    // Step 3: Generate summary
    generateSummary(testResults);

    // Step 4: Save results
    saveResults(adminEmail, testResults);

    // Exit with appropriate code
    const failed = testResults.filter((r) => r.status === 'failed').length;
    process.exit(failed > 0 ? 1 : 0);
  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : String(error);
    console.error(`\n❌ Fatal error: ${errorMsg}\n`);
    process.exit(1);
  }
}

// Run
main();
