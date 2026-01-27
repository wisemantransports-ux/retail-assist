const fs = require('fs');

console.log('=== Verifying Role Assignment Changes ===\n');

const files = [
  { path: 'app/api/employees/accept-invite/route.ts', searches: ['const userRole = invite.role', 'existingUser.role && invite.role', 'concurrentUser.role'] },
  { path: 'app/api/auth/login/route.ts', searches: ['role is missing', 'User role not configured'] },
  { path: 'app/lib/supabase/queries.ts', searches: ['role is missing', 'byAuth.*role'] }
];

files.forEach(file => {
  console.log(`\n📄 ${file.path}:`);
  const content = fs.readFileSync(file.path, 'utf8');
  let found = 0;
  
  file.searches.forEach(search => {
    if (content.includes(search)) {
      console.log(`  ✅ Found: "${search}"`);
      found++;
    }
  });
  
  if (found === file.searches.length) {
    console.log(`  ✓ All ${file.searches.length} changes verified`);
  } else {
    console.log(`  ⚠️  Only ${found}/${file.searches.length} changes found`);
  }
});

console.log('\n=== Verification Complete ===');
