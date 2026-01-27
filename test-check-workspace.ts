import { createAdminSupabaseClient } from './scripts/lib/admin-client.ts';
import * as dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });

const admin = createAdminSupabaseClient();

// Check for workspaces with the name we're trying to create
const workspaceName = 'samuelhelp80@gmail.com Workspace';

const { data: workspaces, error: wsError } = await admin
  .from('workspaces')
  .select('*')
  .eq('name', workspaceName);

console.log(`Checking for workspace: "${workspaceName}"\n`);

if (wsError) {
  console.log('Error:', wsError.message);
} else {
  console.log(`Found ${workspaces?.length || 0} workspace(s)`);
  if (workspaces && workspaces.length > 0) {
    console.log('\n✅ Workspace exists!');
    workspaces.forEach(ws => {
      console.log(`   ID: ${ws.id}`);
      console.log(`   Name: ${ws.name}`);
    });
  }
}

// Now check if there's a user linked to this workspace
if (workspaces && workspaces.length > 0) {
  const workspaceId = workspaces[0].id;
  
  console.log(`\nLooking for users in workspace ${workspaceId}...`);
  const { data: users, error: usersError } = await admin
    .from('users')
    .select('*')
    .eq('workspace_id', workspaceId);
  
  if (usersError) {
    console.log('Error:', usersError.message);
  } else {
    console.log(`Found ${users?.length || 0} user(s)`);
    users?.forEach(u => {
      console.log(`   ID: ${u.id}`);
      console.log(`   Email: ${u.email}`);
      console.log(`   Role: ${u.role}`);
      console.log(`   Auth UID: ${u.auth_uid}`);
    });
  }
}
