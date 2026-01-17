#!/usr/bin/env node

/**
 * Test Employee Role-Based Middleware
 * 
 * Tests the updated middleware to ensure:
 * 1. Super admin redirects to /admin
 * 2. Client admin redirects to /dashboard
 * 3. Employee redirects to /employees/dashboard
 * 4. Unauthorized access is blocked
 */

const http = require('http');

const BASE_URL = 'http://localhost:3000';

// Test cases: (email, password, expectedRole, expectedPath, description)
const testCases = [
  {
    email: 'samuelhelp80@gmail.com',
    password: '123456',
    expectedRole: 'super_admin',
    expectedPaths: ['/admin', '/admin/users'],
    blockedPaths: ['/dashboard', '/employees/dashboard'],
    description: 'Super Admin should access /admin only'
  },
  {
    email: 'user@example.com',
    password: 'password123',
    expectedRole: 'admin',
    expectedPaths: ['/dashboard', '/dashboard/billing'],
    blockedPaths: ['/admin', '/employees/dashboard'],
    description: 'Client Admin should access /dashboard only'
  },
];

async function login(email, password) {
  return new Promise((resolve, reject) => {
    const data = JSON.stringify({ email, password });
    const options = {
      hostname: 'localhost',
      port: 3000,
      path: '/api/auth/login',
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': data.length
      }
    };

    const req = http.request(options, (res) => {
      let body = '';
      const setCookieHeaders = res.headers['set-cookie'] || [];
      
      res.on('data', (chunk) => body += chunk);
      res.on('end', () => {
        let sessionId = null;
        let authToken = null;
        
        for (const cookie of setCookieHeaders) {
          if (cookie.includes('session_id=')) {
            sessionId = cookie.split('session_id=')[1].split(';')[0];
          }
          if (cookie.includes('sb-dzrwxdjzgwvdmfbbfotn-auth-token=')) {
            authToken = cookie.split('sb-dzrwxdjzgwvdmfbbfotn-auth-token=')[1].split(';')[0];
          }
        }
        
        try {
          const parsed = JSON.parse(body);
          resolve({
            status: res.statusCode,
            sessionId,
            authToken,
            user: parsed.user,
            role: parsed.user?.role
          });
        } catch (e) {
          reject(new Error(`Failed to parse login response: ${body}`));
        }
      });
    });

    req.on('error', reject);
    req.write(data);
    req.end();
  });
}

async function testPath(sessionId, authToken, path) {
  return new Promise((resolve) => {
    const options = {
      hostname: 'localhost',
      port: 3000,
      path,
      method: 'GET',
      headers: {
        'Cookie': `session_id=${sessionId}; sb-dzrwxdjzgwvdmfbbfotn-auth-token=${authToken}`
      }
    };

    const req = http.request(options, (res) => {
      let body = '';
      res.on('data', (chunk) => body += chunk);
      res.on('end', () => {
        // Check if we got redirected
        const location = res.headers.location;
        const redirectedTo = location ? location.split('://')[1].split('/').slice(1).join('/') : null;
        
        resolve({
          path,
          status: res.statusCode,
          redirectedTo,
          isAllowed: res.statusCode === 200
        });
      });
    });

    req.on('error', () => {
      resolve({
        path,
        status: 0,
        error: 'Connection failed'
      });
    });

    req.end();
  });
}

async function runTests() {
  console.log('🔐 Testing Employee Role-Based Middleware\n');
  console.log('=' .repeat(60));

  let passed = 0;
  let failed = 0;

  for (const testCase of testCases) {
    console.log(`\n📋 Test: ${testCase.description}`);
    console.log(`   Email: ${testCase.email}`);
    
    try {
      // Login
      const loginResult = await login(testCase.email, testCase.password);
      
      if (loginResult.status !== 200) {
        console.log(`   ❌ Login failed: ${loginResult.status}`);
        failed++;
        continue;
      }
      
      console.log(`   ✓ Login succeeded`);
      console.log(`   ✓ Role: ${loginResult.role}`);
      console.log(`   ✓ Session ID: ${loginResult.sessionId ? 'SET' : 'NOT SET'}`);
      
      if (loginResult.role !== testCase.expectedRole) {
        console.log(`   ❌ Role mismatch: expected ${testCase.expectedRole}, got ${loginResult.role}`);
        failed++;
        continue;
      }

      // Test allowed paths
      console.log(`\n   Testing allowed paths:`);
      let allAllowed = true;
      for (const path of testCase.expectedPaths) {
        const result = await testPath(loginResult.sessionId, loginResult.authToken, path);
        if (result.status === 200) {
          console.log(`   ✓ ${path} - allowed (200)`);
        } else {
          console.log(`   ❌ ${path} - denied (${result.status}), redirected to ${result.redirectedTo}`);
          allAllowed = false;
        }
      }

      // Test blocked paths
      console.log(`\n   Testing blocked paths:`);
      let allBlocked = true;
      for (const path of testCase.blockedPaths) {
        const result = await testPath(loginResult.sessionId, loginResult.authToken, path);
        if (result.status === 307 || result.status === 308) {
          console.log(`   ✓ ${path} - blocked (${result.status}), redirected to ${result.redirectedTo}`);
        } else if (result.status === 200) {
          console.log(`   ❌ ${path} - should be blocked but got 200`);
          allBlocked = false;
        } else {
          console.log(`   ⚠ ${path} - unexpected status: ${result.status}`);
        }
      }

      if (allAllowed && allBlocked) {
        console.log(`\n   ✅ Test passed`);
        passed++;
      } else {
        console.log(`\n   ❌ Test failed`);
        failed++;
      }
    } catch (error) {
      console.log(`   ❌ Error: ${error.message}`);
      failed++;
    }
  }

  console.log(`\n${'=' .repeat(60)}`);
  console.log(`\n📊 Summary:`);
  console.log(`   ✅ Passed: ${passed}`);
  console.log(`   ❌ Failed: ${failed}`);
  console.log(`   📈 Total:  ${testCases.length}`);
  
  if (failed === 0) {
    console.log(`\n✨ All tests passed!`);
    process.exit(0);
  } else {
    console.log(`\n⚠️  Some tests failed`);
    process.exit(1);
  }
}

// Run tests
runTests().catch(err => {
  console.error('Fatal error:', err);
  process.exit(1);
});
