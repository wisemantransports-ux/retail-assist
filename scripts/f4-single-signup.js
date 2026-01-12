(async ()=>{
  const url = process.env.APP_URL || 'http://localhost:5000';
  const email = `frontend-f4-${Date.now()}@test.dev`;
  const payload = {
    email,
    password: 'Password123!',
    full_name: null,
    phone: '+10000000000',
    business_name: 'F4 Single Test Store',
    plan_type: 'starter'
  };
  console.log('Using email:', email);
  const res = await fetch(url + '/api/auth/signup', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
    redirect: 'manual'
  });
  console.log('STATUS', res.status);
  const setCookie = res.headers.get('set-cookie') || res.headers.get('Set-Cookie');
  console.log('SET-COOKIE:', setCookie ? 'PRESENT' : 'MISSING');
  console.log('LOCATION:', res.headers.get('location'));
  const text = await res.text();
  console.log('BODY:', text);
})().catch(e=>{console.error(e); process.exit(1)});
