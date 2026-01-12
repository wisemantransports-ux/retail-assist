#!/usr/bin/env node
require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');

const url = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL || '';
const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || process.env.SUPABASE_ANON_KEY || '';

console.log('temp-signup: using URL present?', Boolean(url));
console.log('temp-signup: using KEY present?', Boolean(key));

if (!url || !key) {
  console.error('temp-signup: Missing Supabase env vars. Aborting test.');
  process.exit(2);
}

const supabase = createClient(url, key);

(async function run() {
  try {
    const email = 'frontendtest1@local.dev';
    const password = 'StrongPassword123!';
    console.log('temp-signup: attempting signUp for', email);
    const { data, error } = await supabase.auth.signUp({ email, password });
    console.log('temp-signup: data:', data);
    console.log('temp-signup: error:', error);
    process.exit(0);
  } catch (err) {
    console.error('temp-signup: exception', err);
    process.exit(1);
  }
})();
