#!/usr/bin/env node

const http = require('http');

// Step 1: Login to get session_id
function login() {
  return new Promise((resolve, reject) => {
    const data = JSON.stringify({
      email: 'samuelhelp80@gmail.com',
      password: '123456'
    });

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
      res.on('data', (chunk) => body += chunk);
      res.on('end', () => {
        // Extract session_id from Set-Cookie header
        const setCookieHeaders = res.headers['set-cookie'] || [];
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
        
        console.log('✓ Login Response Status:', res.statusCode);
        console.log('✓ Session ID:', sessionId);
        console.log('✓ Auth Token present:', !!authToken);
        console.log('✓ Response body:', body);
        
        resolve({ sessionId, authToken });
      });
    });

    req.on('error', reject);
    req.write(data);
    req.end();
  });
}

// Step 2: Test /api/auth/me with session
function testAuthMe(sessionId, authToken) {
  return new Promise((resolve, reject) => {
    const options = {
      hostname: 'localhost',
      port: 3000,
      path: '/api/auth/me',
      method: 'GET',
      headers: {
        'Cookie': `session_id=${sessionId}; sb-dzrwxdjzgwvdmfbbfotn-auth-token=${authToken}`
      }
    };

    const req = http.request(options, (res) => {
      let body = '';
      res.on('data', (chunk) => body += chunk);
      res.on('end', () => {
        console.log('\n✓ /api/auth/me Response Status:', res.statusCode);
        console.log('✓ Response body:', body);
        resolve(res.statusCode === 200);
      });
    });

    req.on('error', reject);
    req.end();
  });
}

// Step 3: Test /api/admin/users with session
function testAdminUsers(sessionId, authToken) {
  return new Promise((resolve, reject) => {
    const options = {
      hostname: 'localhost',
      port: 3000,
      path: '/api/admin/users',
      method: 'GET',
      headers: {
        'Cookie': `session_id=${sessionId}; sb-dzrwxdjzgwvdmfbbfotn-auth-token=${authToken}`
      }
    };

    const req = http.request(options, (res) => {
      let body = '';
      res.on('data', (chunk) => body += chunk);
      res.on('end', () => {
        console.log('\n✓ /api/admin/users Response Status:', res.statusCode);
        if (res.statusCode === 200) {
          const parsed = JSON.parse(body);
          console.log('✓ Users count:', parsed.users?.length || 0);
          console.log('✓ Stats:', parsed.stats);
        } else {
          console.log('✓ Response body:', body);
        }
        resolve(res.statusCode === 200);
      });
    });

    req.on('error', reject);
    req.end();
  });
}

async function main() {
  try {
    console.log('🔐 Testing session flow...\n');
    const { sessionId, authToken } = await login();
    
    if (!sessionId) {
      console.error('❌ No session_id received from login');
      process.exit(1);
    }

    const authMeOk = await testAuthMe(sessionId, authToken);
    const adminUsersOk = await testAdminUsers(sessionId, authToken);

    console.log('\n📊 Summary:');
    console.log('✓ Login:', 'OK');
    console.log('✓ /api/auth/me:', authMeOk ? 'OK' : 'FAILED');
    console.log('✓ /api/admin/users:', adminUsersOk ? 'OK' : 'FAILED');
    
    if (authMeOk && adminUsersOk) {
      console.log('\n✅ All tests passed! Session system is working.');
      process.exit(0);
    } else {
      console.log('\n❌ Some tests failed');
      process.exit(1);
    }
  } catch (err) {
    console.error('❌ Error:', err.message);
    process.exit(1);
  }
}

main();
