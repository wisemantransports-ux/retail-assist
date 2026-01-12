const { chromium } = require('playwright');

(async () => {
  const TEST_EMAIL = `frontend-f4-${Date.now()}@test.dev`;
  const TEST_PASSWORD = 'strongpassword123';
  const BASE = 'http://localhost:5000';
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext();
  const page = await context.newPage();

  try {
    // Intercept signup API response
    let signupResponse = null;
    page.on('requestfinished', async (req) => {
      try {
        const url = req.url();
        if (url.endsWith('/api/auth/signup')) {
          const res = await req.response();
          signupResponse = res;
        }
      } catch (e) {
        // ignore
      }
    });

    // 1) Open signup
    await page.goto(BASE + '/auth/signup', { waitUntil: 'networkidle' });

    // Fill form fields
    await page.fill('input[placeholder="Your business name"]', 'E2E Test Biz');
    await page.fill('input[placeholder="+267 7X XXX XXX"]', '+1 555-000-0000');
    await page.fill('input[placeholder="you@example.com"]', TEST_EMAIL);
    await page.fill('input[placeholder="Min 6 characters"]', TEST_PASSWORD);

    // Submit
    await Promise.all([
      page.waitForNavigation({ waitUntil: 'networkidle', timeout: 15000 }).catch(() => {}),
      page.click('button:has-text("Sign Up")'),
    ]);

    // Wait briefly for network
    await page.waitForTimeout(1000);

    // Evaluate signup API status
    const signupStatus = signupResponse ? signupResponse.status() : null;

    // Check cookie
    const cookies = await context.cookies();
    const sessionCookie = cookies.find(c => c.name === 'session_id');

    const currentUrl = page.url();

    console.log('SIGNUP_API_STATUS=' + signupStatus);
    console.log('SESSION_COOKIE_PRESENT=' + (sessionCookie ? 'YES' : 'NO'));
    console.log('REDIRECT_URL=' + currentUrl);

    // If signup failed, stop
    if (!signupStatus || signupStatus >= 400) {
      console.error('SIGNUP_FAILED');
      await browser.close();
      process.exit(2);
    }

    if (!sessionCookie) {
      console.error('NO_SESSION_COOKIE');
      await browser.close();
      process.exit(3);
    }

    if (!currentUrl.includes('/dashboard')) {
      console.error('NOT_REDIRECTED');
      await browser.close();
      process.exit(4);
    }

    // Verify dashboard loads without auth errors by checking for an element unique to dashboard
    const dashboardOk = await page.$('text=Dashboard') || await page.$('text=Inbox') || await page.$('text=Welcome');
    if (!dashboardOk) {
      console.error('DASHBOARD_LOAD_FAILED');
      const html = await page.content();
      console.log('DASHBOARD_HTML_SNIPPET:' + html.slice(0, 4000));
      await browser.close();
      process.exit(5);
    }

    // LOGOUT: try to find logout link/button
    // Common selectors: text=Log Out, text=Logout, a[href="/auth/logout"]
    const logoutBtn = await page.$('text=Log Out') || await page.$('text=Logout') || await page.$('a[href="/auth/logout"]');
    if (logoutBtn) {
      await Promise.all([
        page.waitForNavigation({ waitUntil: 'networkidle', timeout: 10000 }).catch(() => {}),
        logoutBtn.click(),
      ]);
    } else {
      // fallback: clear cookie
      await context.clearCookies();
    }

    // Ensure logged out (no session cookie)
    const cookiesAfter = await context.cookies();
    const sessionAfter = cookiesAfter.find(c => c.name === 'session_id');
    console.log('SESSION_AFTER_LOGOUT=' + (sessionAfter ? 'YES' : 'NO'));

    // LOGIN: navigate to login page
    await page.goto(BASE + '/auth/login', { waitUntil: 'networkidle' });
    await page.fill('input[type=email]', TEST_EMAIL);
    await page.fill('input[type=password]', TEST_PASSWORD);

    await Promise.all([
      page.waitForNavigation({ waitUntil: 'networkidle', timeout: 15000 }).catch(() => {}),
      page.click('button:has-text("Log In")'),
    ]);

    // Wait a bit
    await page.waitForTimeout(1000);
    const cookiesAfterLogin = await context.cookies();
    const sessionAfterLogin = cookiesAfterLogin.find(c => c.name === 'session_id');
    const urlAfterLogin = page.url();

    console.log('SESSION_AFTER_LOGIN=' + (sessionAfterLogin ? 'YES' : 'NO'));
    console.log('URL_AFTER_LOGIN=' + urlAfterLogin);

    const dashboardOk2 = await page.$('text=Dashboard') || await page.$('text=Inbox') || await page.$('text=Welcome');
    console.log('DASHBOARD_ACCESS_AFTER_LOGIN=' + (dashboardOk2 ? 'YES' : 'NO'));

    await browser.close();
    process.exit(0);
  } catch (err) {
    console.error('TEST_ERROR', err);
    await browser.close();
    process.exit(1);
  }
})();
