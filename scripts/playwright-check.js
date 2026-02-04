const { chromium } = require('playwright');

(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage();

  page.on('console', (msg) => {
    console.log('[PAGE CONSOLE]', msg.type(), msg.text());
  });

  page.on('pageerror', (err) => {
    console.error('[PAGE ERROR]', err);
  });

  page.on('request', (req) => {
    console.log('[REQUEST]', req.method(), req.url());
  });

  page.on('response', async (res) => {
    if (res.url().includes('/api/auth/me')) {
      console.log('[RESPONSE]', res.status(), res.url());
      try {
        const text = await res.text();
        console.log('[RESPONSE BODY]', text);
      } catch (e) {}
    }
  });

  try {
    console.log('Navigating to /dashboard');
    await page.goto('http://127.0.0.1:3000/dashboard', { waitUntil: 'networkidle' });
    console.log('Loaded /dashboard');

    console.log('Navigating to /admin');
    await page.goto('http://127.0.0.1:3000/admin', { waitUntil: 'networkidle' });
    console.log('Loaded /admin');
  } catch (err) {
    console.error('Error during navigation:', err);
  } finally {
    await browser.close();
  }
})();