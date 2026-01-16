#!/usr/bin/env node

const http = require('http');

// Simulate full browser login flow
async function testFullFlow() {
  console.log('🔐 Testing full browser login flow...\n');

  // Step 1: Login
  console.log('1️⃣ Posting to /api/auth/login...');
  const { sessionId, authToken } = await new Promise((resolve, reject) => {
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
        
        console.log(`   ✓ Login succeeded (${res.statusCode})`);
        console.log(`   ✓ session_id: ${sessionId ? 'SET' : 'NOT SET'}`);
        console.log(`   ✓ auth token: ${authToken ? 'SET' : 'NOT SET'}`);
        
        resolve({ sessionId, authToken });
      });
    });

    req.on('error', reject);
    req.write(data);
    req.end();
  });

  if (!sessionId || !authToken) {
    console.error('❌ Login failed - no cookies');
    process.exit(1);
  }

  // Step 2: Call /api/auth/me (what admin page does)
  console.log('\n2️⃣ Calling /api/auth/me to verify session...');
  const authMeOk = await new Promise((resolve, reject) => {
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
        console.log(`   ✓ /api/auth/me returned ${res.statusCode}`);
        if (res.statusCode === 200) {
          const data = JSON.parse(body);
          console.log(`   ✓ User email: ${data.user.email}`);
          console.log(`   ✓ User role: ${data.user.role}`);
          console.log(`   ✓ workspace_id: ${data.user.workspace_id}`);
        } else {
          console.log(`   ❌ Response: ${body}`);
        }
        resolve(res.statusCode === 200);
      });
    });

    req.on('error', reject);
    req.end();
  });

  // Step 3: Call /api/admin/users (also requires session)
  console.log('\n3️⃣ Calling /api/admin/users...');
  const adminUsersOk = await new Promise((resolve, reject) => {
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
        console.log(`   ✓ /api/admin/users returned ${res.statusCode}`);
        if (res.statusCode === 200) {
          const data = JSON.parse(body);
          console.log(`   ✓ Users count: ${data.users.length}`);
        } else {
          console.log(`   ❌ Response: ${body}`);
        }
        resolve(res.statusCode === 200);
      });
    });

    req.on('error', reject);
    req.end();
  });

  // Step 4: Simulate middleware check (calls RPC)
  console.log('\n4️⃣ Testing if middleware session valid...');
  const middlewareOk = await new Promise((resolve, reject) => {
    const options = {
      hostname: 'localhost',
      port: 3000,
      path: '/admin',
      method: 'GET',
      headers: {
        'Cookie': `session_id=${sessionId}; sb-dzrwxdjzgwvdmfbbfotn-auth-token=${authToken}`
      }
    };

    const req = http.request(options, (res) => {
      console.log(`   ✓ /admin returned ${res.statusCode}`);
      if (res.statusCode === 200) {
        console.log('   ✓ Middleware allowed access');
      } else if (res.statusCode === 307 || res.statusCode === 308) {
        const location = res.headers.location;
        console.log(`   ⚠️  Redirect to: ${location}`);
        if (location && location.includes('login')) {
          console.log('   ❌ Middleware redirecting to login!');
        }
      }
      resolve(res.statusCode === 200);
    });

    req.on('error', reject);
    req.end();
  });

  console.log('\n📊 Summary:');
  console.log(`✓ /api/auth/me: ${authMeOk ? '✅' : '❌'}`);
  console.log(`✓ /api/admin/users: ${adminUsersOk ? '✅' : '❌'}`);
  console.log(`✓ Middleware /admin: ${middlewareOk ? '✅' : '❌'}`);

  if (authMeOk && adminUsersOk && middlewareOk) {
    console.log('\n✅ All checks passed!');
  } else {
    console.log('\n❌ Some checks failed');
  }
}

testFullFlow().catch(err => {
  console.error('❌ Error:', err.message);
  process.exit(1);
});
