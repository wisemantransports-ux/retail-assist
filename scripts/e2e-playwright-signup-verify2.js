const { chromium } = require('playwright');

(async () => {
  const TEST_EMAIL = 'frontendverify2@test.dev';
  const TEST_PASSWORD = 'StrongPassword123';
  const BASE = 'http://localhost:5000';
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext();
  const page = await context.newPage();

  try {
    let signupResponse = null;
    page.on('requestfinished', async (req) => {
      try {
        const url = req.url();
        if (url.endsWith('/api/auth/signup')) {
          signupResponse = await req.response();
        }
      } catch (e) {}
    });

    // Open signup
    await page.goto(BASE + '/auth/signup', { waitUntil: 'networkidle' });

    // Fill form
    await page.fill('input[placeholder="Your business name"]', 'Frontend Verify Store');
    await page.fill('input[placeholder="+267 7X XXX XXX"]', '+26770000001');
    await page.fill('input[placeholder="you@example.com"]', TEST_EMAIL);
    await page.fill('input[placeholder="Min 6 characters"]', TEST_PASSWORD);

    // Submit and wait
    await Promise.all([
      page.waitForNavigation({ waitUntil: 'networkidle', timeout: 15000 }).catch(() => {}),
      page.click('button:has-text("Sign Up")'),
    ]);

    await page.waitForTimeout(1000);

    const status = signupResponse ? signupResponse.status() : null;
    const cookies = await context.cookies();
    const sessionCookie = cookies.find(c => c.name === 'session_id');
    const url = page.url();

    console.log('SIGNUP_API_STATUS=' + status);
    console.log('SESSION_COOKIE_PRESENT=' + (sessionCookie ? 'YES' : 'NO'));
    console.log('REDIRECT_URL=' + url);

    if (!status || status >= 400) {
      console.error('FAIL: signup API error');
      await browser.close();
      process.exit(2);
    }

    if (!sessionCookie) {
      console.error('FAIL: session cookie missing');
      await browser.close();
      process.exit(3);
    }

    if (!url.includes('/dashboard')) {
      console.error('FAIL: not redirected to dashboard');
      await browser.close();
      process.exit(4);
    }

    console.log('PASS: F-4 completed');
    await browser.close();
    process.exit(0);
  } catch (err) {
    console.error('TEST_ERROR', err);
    await browser.close();
    process.exit(1);
  }
})();
