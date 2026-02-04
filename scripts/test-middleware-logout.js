#!/usr/bin/env node

const http = require('http');

async function testLogoutMiddleware() {
  console.log('🔍 Testing middleware behavior for unauthenticated requests...');

  return new Promise((resolve, reject) => {
    const options = {
      hostname: 'localhost',
      port: 3000,
      path: '/admin',
      method: 'GET',
      headers: {}
    };

    const req = http.request(options, (res) => {
      console.log(' → /admin returned', res.statusCode);

      if (res.statusCode === 200) {
        console.log('   ✓ Middleware allowed unauthenticated request to continue (200)');
        resolve(0);
        return;
      }

      const location = res.headers.location || '';
      if (res.statusCode === 307 || res.statusCode === 308) {
        console.error('   ✗ Middleware redirected to:', location);
        process.exit(1);
      }

      console.warn('   ⚠ Unexpected status:', res.statusCode);
      resolve(1);
    });

    req.on('error', (err) => {
      console.error('   ✗ Request failed:', err.message);
      reject(err);
    });

    req.end();
  });
}

async function run() {
  try {
    const code = await testLogoutMiddleware();
    process.exit(code);
  } catch (err) {
    console.error('Fatal:', err.message);
    process.exit(1);
  }
}

run();
