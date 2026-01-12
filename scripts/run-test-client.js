const { chromium } = require('playwright');
const child = require('child_process');
const fs = require('fs');
(async ()=>{
  try {
    const ts = child.execSync('date +%s').toString().trim();
    const EMAIL = `frontend-f4-${ts}@test.dev`;
    const PASS = 'Password123!';
    console.log('Creating user', EMAIL);
    child.execSync(`curl -s -X POST http://localhost:5000/api/auth/signup -H "Content-Type: application/json" -d '{"email":"${EMAIL}","password":"${PASS}","full_name":null,"phone":"+10000000000","business_name":"F4 Test Client","plan_type":"starter"}' -o /tmp/signup.json`);
    console.log('SIGNUP_RESP:', fs.readFileSync('/tmp/signup.json','utf8'));

    const browser = await chromium.launch({ headless: true });
    const context = await browser.newContext();
    const page = await context.newPage();
    page.on('console', m => console.log('BROWSER:', m.text()));
    await page.goto(`http://localhost:5000/test-client?email=${EMAIL}&password=${PASS}`, { waitUntil: 'networkidle' });
    await page.waitForSelector('pre', { timeout: 10000 });
    const txt = await page.textContent('pre');
    console.log('PAGE_PRE:', txt);
    await browser.close();
  } catch (e) {
    console.error(e);
    process.exit(1);
  }
})()
