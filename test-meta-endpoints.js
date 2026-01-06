#!/usr/bin/env node

/**
 * Meta Webhook Endpoint Test
 * Tests webhook verification and message processing
 */

const http = require('http');

const BASE_URL = 'http://localhost:5000';

async function makeRequest(url, options = {}) {
  return new Promise((resolve, reject) => {
    const req = http.get(url, options, (res) => {
      let data = '';
      res.on('data', (chunk) => data += chunk);
      res.on('end', () => {
        try {
          const result = {
            status: res.statusCode,
            headers: res.headers,
            data: data
          };
          resolve(result);
        } catch (e) {
          resolve({ status: res.statusCode, data });
        }
      });
    });

    req.on('error', reject);
    req.setTimeout(5000, () => {
      req.destroy();
      reject(new Error('Request timeout'));
    });
  });
}

async function testWebhookVerification() {
  console.log('\n🔍 Testing Facebook Webhook Verification...\n');

  const verifyUrl = `${BASE_URL}/api/webhooks/facebook?hub.mode=subscribe&hub.verify_token=retail_assist_verify_2024&hub.challenge=test_challenge_123`;

  try {
    const response = await makeRequest(verifyUrl);
    console.log('Status:', response.status);
    console.log('Response:', response.data);

    if (response.status === 200 && response.data === 'test_challenge_123') {
      console.log('✅ Webhook verification: PASSED');
      return true;
    } else {
      console.log('❌ Webhook verification: FAILED');
      return false;
    }
  } catch (error) {
    console.log('❌ Webhook verification: ERROR -', error.message);
    console.log('Note: Server may not be running. Start with: npm run dev');
    return false;
  }
}

async function testInstagramWebhookVerification() {
  console.log('\n🔍 Testing Instagram Webhook Verification...\n');

  const verifyUrl = `${BASE_URL}/api/webhooks/instagram?hub.mode=subscribe&hub.verify_token=retail_assist_verify_2024&hub.challenge=instagram_test_123`;

  try {
    const response = await makeRequest(verifyUrl);
    console.log('Status:', response.status);
    console.log('Response:', response.data);

    if (response.status === 200 && response.data === 'instagram_test_123') {
      console.log('✅ Instagram webhook verification: PASSED');
      return true;
    } else {
      console.log('❌ Instagram webhook verification: FAILED');
      return false;
    }
  } catch (error) {
    console.log('❌ Instagram webhook verification: ERROR -', error.message);
    return false;
  }
}

async function testMetaOAuthEndpoint() {
  console.log('\n🔍 Testing Meta OAuth Endpoint...\n');

  const oauthUrl = `${BASE_URL}/api/meta/oauth`;

  try {
    const response = await makeRequest(oauthUrl);
    console.log('Status:', response.status);

    if (response.status === 401) {
      console.log('✅ OAuth endpoint: Requires authentication (expected)');
      return true;
    } else if (response.status === 200) {
      console.log('ℹ️  OAuth endpoint: Accessible (may need auth setup)');
      return true;
    } else {
      console.log('❌ OAuth endpoint: Unexpected status');
      return false;
    }
  } catch (error) {
    console.log('❌ OAuth endpoint: ERROR -', error.message);
    return false;
  }
}

async function runTests() {
  console.log('🚀 META INTEGRATION ENDPOINT TESTS');
  console.log('==================================');

  const results = {
    facebookWebhook: await testWebhookVerification(),
    instagramWebhook: await testInstagramWebhookVerification(),
    metaOAuth: await testMetaOAuthEndpoint()
  };

  console.log('\n📊 TEST RESULTS SUMMARY');
  console.log('=======================');

  const passed = Object.values(results).filter(Boolean).length;
  const total = Object.keys(results).length;

  Object.entries(results).forEach(([test, passed]) => {
    const status = passed ? '✅' : '❌';
    console.log(`${status} ${test}: ${passed ? 'PASSED' : 'FAILED'}`);
  });

  console.log(`\n🎯 Overall: ${passed}/${total} tests passed`);

  if (passed === total) {
    console.log('\n🎉 All endpoint tests passed! Ready for Meta app configuration.');
  } else {
    console.log('\n⚠️  Some tests failed. Check server logs and configuration.');
  }

  console.log('\n📋 NEXT STEPS:');
  console.log('1. Configure Meta app in Facebook Developers Console');
  console.log('2. Set webhook URLs to your production domain');
  console.log('3. Update environment variables with real credentials');
  console.log('4. Test OAuth flow with real Facebook page');
  console.log('5. Send test messages to verify end-to-end flow');
}

// Run tests
runTests().catch(console.error);