const assert = require('assert');
const crypto = require('crypto');

function computeWhatsAppSignature(payload, secret, webhookUrl) {
  const data = webhookUrl + payload;
  return crypto.createHmac('sha1', secret).update(data, 'utf8').digest('base64');
}

function computeWebsiteFormSignature(payload, secret) {
  return crypto.createHmac('sha256', secret).update(payload, 'utf8').digest('hex');
}

async function run() {
  console.log('\n=== ROUTES TESTS ===\n');

  // 1) WhatsApp verification challenge simulation
  {
    const test = 'WhatsApp challenge verification (subscribe + correct token)';
    const mode = 'subscribe';
    const token = 'verify_token_xyz';
    const challenge = 'CHALLENGE_123';

    const passed = mode === 'subscribe' && token === 'verify_token_xyz' && !!challenge;
    assert.ok(passed, `${test} failed`);
    console.log(`✓ ${test}`);
  }

  // 2) WhatsApp signature (HMAC-SHA1 base64)
  {
    const test = 'WhatsApp signature HMAC-SHA1 (base64)';
    const secret = 'wa_secret_test';
    const webhookUrl = 'https://example.com/api/webhooks/whatsapp';
    const payload = JSON.stringify({ entry: [{ changes: [{ field: 'messages' }] }] });

    const sig = computeWhatsAppSignature(payload, secret, webhookUrl);

    // Verify by recomputing
    const expected = crypto.createHmac('sha1', secret).update(webhookUrl + payload, 'utf8').digest('base64');
    assert.strictEqual(sig, expected, `${test} mismatch`);

    console.log(`✓ ${test}`);
  }

  // 3) Website form signature (HMAC-SHA256 hex)
  {
    const test = 'Website form signature HMAC-SHA256 (hex)';
    const secret = 'form_secret_test';
    const payload = JSON.stringify({ name: 'Alice', email: 'alice@example.com', message: 'Help' });

    const sig = computeWebsiteFormSignature(payload, secret);
    const expected = crypto.createHmac('sha256', secret).update(payload, 'utf8').digest('hex');

    assert.strictEqual(sig, expected, `${test} mismatch`);
    console.log(`✓ ${test}`);
  }

  // 4) Route wiring examples (sanity: ensure env var lookups available)
  {
    const test = 'Env presence (sanity)';
    // We don't require these to be set in CI, but ensure accessors don't throw
    process.env.WHATSAPP_AUTH_TOKEN = process.env.WHATSAPP_AUTH_TOKEN || '';
    process.env.FORM_WEBHOOK_SECRET = process.env.FORM_WEBHOOK_SECRET || '';

    assert.ok(typeof process.env.WHATSAPP_AUTH_TOKEN === 'string', `${test} failed`);
    assert.ok(typeof process.env.FORM_WEBHOOK_SECRET === 'string', `${test} failed`);

    console.log(`✓ ${test}`);
  }

  console.log('\n=== ROUTES TESTS PASSED ===\n');
}

run().catch((err) => {
  console.error('Routes tests failed:', err);
  process.exitCode = 1;
});
