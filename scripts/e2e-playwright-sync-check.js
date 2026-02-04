const { chromium } = require('playwright');

(async () => {
  const TEST_EMAIL = `e2e-sync-${Date.now()}@test.dev`;
  const TEST_PASSWORD = 'StrongPassw0rd!';
  const BASE = process.env.BASE_URL || 'http://localhost:3000';
  console.log('TEST_BASE:', BASE);

  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext();
  const page = await context.newPage();

  let syncCalled = false;
  let syncResponseSetCookie = false;
  let syncResponseHeaders = null;

  page.on('requestfinished', async (req) => {
    try {
      const url = req.url();
      if (url.endsWith('/api/auth/sync')) {
        syncCalled = true;
        const res = await req.response();
        if (res) {
          const headers = res.headers();
          syncResponseHeaders = headers;
          const sc = headers['set-cookie'] || headers['Set-Cookie'] || headers['set-cookie'];
          if (sc) syncResponseSetCookie = true;
        }
      }
    } catch (e) {
      console.warn('requestfinished handler error', e.message);
    }
  });

  try {
    // Go to signup
    await page.goto(BASE + '/auth/signup', { waitUntil: 'networkidle' });

    await page.fill('input[placeholder="Your business name"]', 'E2E Sync Test');
    await page.fill('input[placeholder="+267 7X XXX XXX"]', '+1 555-000-0000');
    await page.fill('input[placeholder="you@example.com"]', TEST_EMAIL);
    await page.fill('input[placeholder="Min 6 characters"]', TEST_PASSWORD);

    await Promise.all([
      page.waitForNavigation({ waitUntil: 'networkidle', timeout: 15000 }).catch(() => {}),
      page.click('button:has-text("Sign Up")'),
    ]);

    // Wait for network
    await page.waitForTimeout(1000);

    // Inspect cookies
    const cookies = await context.cookies();
    const sbCookies = cookies.filter(c => c.name.startsWith('sb-') || c.name.includes('sb-'));

    console.log('SYNC_CALLED=' + (syncCalled ? 'YES' : 'NO'));
    console.log('SYNC_RESPONSE_SET_COOKIE=' + (syncResponseSetCookie ? 'YES' : 'NO'));
    if (syncResponseHeaders) console.log('SYNC_RESPONSE_HEADERS=' + JSON.stringify(syncResponseHeaders));

    console.log('SB_COOKIES_PRESENT=' + (sbCookies.length ? 'YES' : 'NO'));
    if (sbCookies.length) {
      console.log('SB_COOKIE_DETAILS=' + JSON.stringify(sbCookies, null, 2));
    }

    // Call /api/auth/me via page context to include cookies
    const meResult = await page.evaluate(async () => {
      try {
        const res = await fetch('/api/auth/me', { credentials: 'include' });
        const text = await res.text();
        return { status: res.status, body: text };
      } catch (err) {
        return { error: err.message };
      }
    });

    console.log('API_AUTH_ME_RESULT=' + JSON.stringify(meResult));

    await browser.close();

    // Exit codes: 0 success if sbCookies present and sync called and meResult.status === 200
    if (sbCookies.length && syncCalled && meResult && meResult.status === 200) {
      console.log('E2E_SYNC_OK');
      process.exit(0);
    }

    console.error('E2E_SYNC_FAILED');
    process.exit(2);
  } catch (err) {
    console.error('TEST_ERROR', err);
    await browser.close();
    process.exit(1);
  }
})();