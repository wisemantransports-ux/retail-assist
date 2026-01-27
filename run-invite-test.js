#!/usr/bin/env node

/**
 * Helper script to run the employee invite flow test
 * This script:
 * 1. Compiles the TypeScript test file
 * 2. Runs the tests
 * 3. Reports results
 * 
 * Usage:
 *   npm run test:invite-flow
 *   # or
 *   node run-invite-test.js
 * 
 * Requirements:
 *   - Application must be running (npm run dev)
 *   - Must have TEST_AUTH_TOKEN environment variable set
 *   - Must have a super_admin account created
 */

const { spawn } = require('child_process');
const path = require('path');
const fs = require('fs');

const testFilePath = path.join(__dirname, 'test-employee-invite-flow.ts');

if (!fs.existsSync(testFilePath)) {
  console.error('❌ Test file not found:', testFilePath);
  process.exit(1);
}

console.log('🚀 Running Employee Invite Flow Test...\n');

// Run with ts-node
const child = spawn(
  'npx',
  ['ts-node', '-r', 'tsconfig-paths/register', 'test-employee-invite-flow.ts'],
  {
    cwd: __dirname,
    stdio: 'inherit',
    env: process.env,
  }
);

child.on('close', (code) => {
  if (code === 0) {
    console.log('\n✅ Test completed successfully');
  } else {
    console.log('\n❌ Test failed with exit code', code);
  }
  process.exit(code);
});

child.on('error', (error) => {
  console.error('Failed to start test:', error);
  process.exit(1);
});
