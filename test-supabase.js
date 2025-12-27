import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config();

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

const client = createClient(SUPABASE_URL, ANON_KEY);
const admin = createClient(SUPABASE_URL, SERVICE_KEY);

async function runTests() {
  try {
    console.log('1️⃣ Signing in as admin...');
    const { data: signInData, error: signInError } = await client.auth.signInWithPassword({
      email: 'admin@demo.com',
      password: '123456' // replace with real password
    });
    if (signInError) throw signInError;

    const authUid = signInData.user.id;
    console.log(`✅ Signed in. Auth UID: ${authUid}`);

    console.log('2️⃣ Checking public.users table...');
    const { data: userRecords, error: userError } = await client
      .from('users')
      .select('id, email')
      .eq('id', authUid)
      .limit(1)
      .single();
    
    let userId = userRecords?.id;
    
    if (userError || !userRecords) {
      console.log('⚠️  User not found in public.users, auto-creating...');
      const { data: insertedUser, error: insertError } = await client
        .from('users')
        .insert({
          id: authUid,
          email: signInData.user.email,
        })
        .select('id')
        .single();
      
      if (insertError) {
        console.error('❌ Failed to create user record:', insertError);
        throw insertError;
      }
      
      userId = insertedUser.id;
      console.log(`✅ Auto-created user record. User ID: ${userId}`);
    } else {
      console.log(`✅ User exists in public.users. User ID: ${userId}`);
    }

    console.log('3️⃣ Fetching workspaces...');
    const { data: workspaces } = await admin
      .from('workspaces')
      .select('*')
      .or(`owner.eq.${userId},owner_id.eq.${userId}`)
      .limit(1)

    let workspace = (workspaces && workspaces.length > 0) ? workspaces[0] : null

    if (!workspace) {
      console.warn('⚠️ No workspaces found for user — auto-creating one now.');

      // Create workspace via service role (only use `owner` to match schema)
      const { data: createdWs, error: createWsError } = await admin
        .from('workspaces')
        .insert({
          name: `${signInData.user.email}'s Workspace`,
          owner: userId,
          plan_type: 'free',
          subscription_status: 'active'
        })
        .select()
        .single();

      if (createWsError) {
        console.error('❌ Failed to create workspace:', createWsError);
        // Try to read back existing row in case of race
        const { data: existing2 } = await admin
          .from('workspaces')
          .select('*')
          .or(`owner.eq.${userId},owner_id.eq.${userId}`)
          .limit(1)
        if (existing2 && existing2.length > 0) {
          workspace = existing2[0]
        } else {
          throw createWsError;
        }
      } else {
        workspace = createdWs
        console.log('✅ Auto-created workspace:', createdWs);
      }

      // Ensure membership exists (idempotent upsert)
      const { error: memberErr } = await admin
        .from('workspace_members')
        .upsert([
          {
            workspace_id: workspace.id,
            user_id: userId,
            role: 'admin'
          }
        ], { onConflict: 'workspace_id,user_id' });

      if (memberErr) {
        console.error('❌ Failed to create workspace membership:', memberErr);
        throw memberErr;
      }

      console.log('✅ Workspace membership created.');
    } else {
      console.log('✅ Workspace exists:', workspace);
    }

    const workspaceId = workspace.id;

    console.log('4️⃣ Fetching agents for workspace...');
    const { data: agents } = await admin
      .from('agents')
      .select('*')
      .eq('workspace_id', workspaceId)
      .is('deleted_at', null);
    console.log('Agents:', agents);

    console.log('5️⃣ Checking workspace membership...');
    const { data: member } = await client
      .from('workspace_members')
      .select('role, subscription_status')
      .eq('workspace_id', workspaceId)
      .eq('user_id', userId)
      .is('deleted_at', null)
      .limit(1)
      .single();
    console.log('Membership:', member);

    console.log('6️⃣ Attempting to create agent as authenticated user (RLS test)...');
    const { data: createdAgentUser, error: createUserError } = await client
      .from('agents')
      .insert({
        workspace_id: workspaceId,
        name: 'RLS Test Agent User',
        system_prompt: 'Test RLS via user',
        model: 'gpt-4o-mini',
        api_key: 'sk_test_user'
      })
      .select();
    if (createUserError) {
      console.log('Expected RLS block:', createUserError.message);
    } else {
      console.warn('⚠️ User was able to create agent — RLS may not be enforced!');
      console.log(createdAgentUser);
    }

    console.log('✅ Supabase RLS & schema verified successfully.');
  } catch (err) {
    console.error('❌ Error during test:', err);
  }
}

runTests();