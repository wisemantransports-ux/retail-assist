// This file will store the F-4 test results
const fs = require('fs');
const path = require('path');

const resultsFile = path.join(__dirname, 'f4-test-results.md');

async function runF4Test() {
  const results = ['# F-4 E2E Test Results', ''];
  
  function log(msg) {
    results.push(msg);
  }
  
  try {
    log(`Test started at: ${new Date().toISOString()}`);
    log('');
    log('## Signup API Test');
    log('');
    
    const email = `f4test-${Date.now()}@test.dev`;
    log(`Email: ${email}`);
    
    const data = JSON.stringify({
      email,
      password: 'TestPass@123456',
      business_name: 'F4 Test Business',
      phone: '+1234567890'
    });
    
    log('Making POST request to http://localhost:5000/api/auth/signup...');
    log('');
    
    const http = require('http');
    
    return new Promise((resolve) => {
      const req = http.request(
        {
          hostname: 'localhost',
          port: 5000,
          path: '/api/auth/signup',
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Content-Length': data.length
          }
        },
        (res) => {
          let body = '';
          const setCookies = res.headers['set-cookie'] || [];
          const location = res.headers['location'] || '';
          
          res.on('data', (chunk) => { body += chunk; });
          res.on('end', () => {
            log('### Response');
            log(`- **HTTP Status**: ${res.statusCode}`);
            const hasCookie = setCookies.some(c => c.includes('session_id'));
            log(`- **Session Cookie**: ${hasCookie ? 'YES ✅' : 'NO ❌'}`);
            log(`- **Redirect URL**: ${location || 'NONE'}`);
            log('');
            
            log('### Result');
            if (res.statusCode !== 200) {
              log('❌ **FAIL** - Signup returned non-200 status');
              log(`  - Status ${res.statusCode} (expected 200)`);
            } else if (!hasCookie) {
              log('❌ **FAIL** - No session_id cookie');
            } else {
              log('✅ **PASS** - Signup successful, session cookie set');
              log('');
              log('### Verifying session with /api/auth/me');
              
              // Extract the session ID from the cookie
              const cookieHeader = setCookies.find(c => c.includes('session_id='));
              if (!cookieHeader) {
                log('❌ Could not extract session cookie');
                fs.writeFileSync(resultsFile, results.join('\n'));
                resolve();
                return;
              }
              
              const sessionId = cookieHeader.split('session_id=')[1].split(';')[0];
              log(`Session ID: ${sessionId.substring(0, 20)}...`);
              log('');
              
              // Make a request to /api/auth/me with the session cookie
              const authMeReq = require('http').request(
                {
                  hostname: 'localhost',
                  port: 5000,
                  path: '/api/auth/me',
                  method: 'GET',
                  headers: {
                    'Cookie': `session_id=${sessionId}`
                  }
                },
                (authMeRes) => {
                  let authMeBody = '';
                  authMeRes.on('data', (chunk) => { authMeBody += chunk; });
                  authMeRes.on('end', () => {
                    log(`- **/api/auth/me Status**: ${authMeRes.statusCode}`);
                    if (authMeRes.statusCode === 200) {
                      try {
                        const userData = JSON.parse(authMeBody);
                        log(`- **User ID**: ${userData.user?.id?.substring(0, 20)}...`);
                        log(`- **User Email**: ${userData.user?.email || 'N/A'}`);
                        log(`- **Business Name**: ${userData.user?.business_name || 'N/A'}`);
                        log('');
                        log('✅ **E2E PASS** - Session verification successful, user data retrieved');
                      } catch (e) {
                        log(`- **Response**: ${authMeBody.substring(0, 100)}`);
                        log('❌ Could not parse user data');
                      }
                    } else {
                      log(`- **Error**: ${authMeBody.substring(0, 200)}`);
                      log('❌ Session verification failed - /api/auth/me returned non-200');
                    }
                    
                    fs.writeFileSync(resultsFile, results.join('\n'));
                    resolve();
                  });
                }
              );
              
              authMeReq.on('error', (err) => {
                log(`❌ **ERROR**: ${err.message}`);
                fs.writeFileSync(resultsFile, results.join('\n'));
                resolve();
              });
              
              authMeReq.end();
            }
            
            if (res.statusCode !== 200 || !hasCookie) {
              log('');
              log('### Response Body');
              log('```');
              log(body.substring(0, 500));
              log('```');
              fs.writeFileSync(resultsFile, results.join('\n'));
              resolve();
            }
          });
        }
      );
      
      req.on('error', (err) => {
        log(`❌ **ERROR**: ${err.message}`);
        fs.writeFileSync(resultsFile, results.join('\n'));
        resolve();
      });
      
      req.write(data);
      req.end();
    });
    
  } catch (err) {
    log(`❌ **ERROR**: ${err.message}`);
    fs.writeFileSync(resultsFile, results.join('\n'));
  }
}

runF4Test();
