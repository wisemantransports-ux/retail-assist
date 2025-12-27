import { createClient } from '@supabase/supabase-js'

const url = process.env.NEXT_PUBLIC_SUPABASE_URL
const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY

if (!url || !anonKey || !serviceKey) {
  console.error('Missing NEXT_PUBLIC_SUPABASE_URL, NEXT_PUBLIC_SUPABASE_ANON_KEY, or SUPABASE_SERVICE_ROLE_KEY')
  process.exit(1)
}

const client = createClient(url, anonKey)
const admin = createClient(url, serviceKey)

const email = 'admin@demo.com'
const password = '123456'

async function run() {
  const sign = await client.auth.signInWithPassword({ email, password })
  if (sign.error) {
    console.error('Sign-in failed:', sign.error)
    process.exit(2)
  }
  const user = sign.data.user
  console.log('Signed in user id:', user.id)

  // List workspaces owned by user
    // Match live schema: workspaces.owner (UUID) references users.id
    const { data: workspaces, error: wsError } = await admin
      .from('workspaces')
      .select('*')
      .eq('owner', user.id)
  if (wsError) {
    console.error('Failed to fetch workspaces:', wsError)
    process.exit(3)
  }

  console.log('Workspaces:', JSON.stringify(workspaces, null, 2))

  if (!workspaces || workspaces.length === 0) {
    console.log('No workspaces found for user; skipping agents query.')
    return
  }

  const workspaceId = workspaces[0].id

  // Fetch agents for this workspace (respect soft-deletes)
  const { data: agents, error: agentsError } = await admin
    .from('agents')
    .select('*')
    .eq('workspace_id', workspaceId)
    .is('deleted_at', null)
    .order('created_at', { ascending: false })

  if (agentsError) {
    console.error('Failed to fetch agents:', agentsError)
    process.exit(4)
  }

  console.log('Agents for workspace', workspaceId, JSON.stringify(agents, null, 2))
  
  // Fetch automation rules for a demo agent (pick agent by name or first agent)
  const demoAgent = agents.find((a) => /demo/i.test(a.name)) || agents[0]
  if (!demoAgent) {
    console.log('No agent available to fetch automation rules for.')
    return
  }

  const { data: rules, error: rulesError } = await admin
    .from('automation_rules')
    .select('*')
    .eq('agent_id', demoAgent.id)
    .is('deleted_at', null)
    .order('created_at', { ascending: false })

  if (rulesError) {
    console.error('Failed to fetch automation rules:', rulesError)
  } else {
    console.log('Automation rules for agent', demoAgent.id, JSON.stringify(rules, null, 2))
  }

  // Verify workspace membership via admin client (active members only)
  const { data: member, error: memberError } = await admin
    .from('workspace_members')
    .select('role,subscription_status,deleted_at')
    .eq('workspace_id', workspaceId)
    .eq('user_id', user.id)
    .is('deleted_at', null)
    .limit(1)
    .single()

  if (memberError) {
    console.error('Failed to fetch workspace_members:', memberError)
  } else {
    console.log('Membership row:', JSON.stringify(member, null, 2))
  }

  // Attempt to create an agent as the signed-in user (RLS should enforce policies)
  const newAgentPayload = {
    workspace_id: workspaceId,
    name: 'Test RLS Agent',
    system_prompt: 'RLS test agent',
    model: 'gpt-4o-mini',
  }

  const createAsUser = await client
    .from('agents')
    .insert(newAgentPayload)
    .select()

  if (createAsUser.error) {
    console.log('Create agent as user blocked/failed (expected if RLS denies):', createAsUser.error)
  } else {
    console.log('Create agent as user succeeded:', JSON.stringify(createAsUser.data, null, 2))
  }

  // Attempt same create as admin (service role) — should bypass RLS
  const createAsAdmin = await admin
    .from('agents')
    .insert(newAgentPayload)
    .select()

  if (createAsAdmin.error) {
    console.error('Create agent as admin failed:', createAsAdmin.error)
  } else {
    console.log('Create agent as admin succeeded:', JSON.stringify(createAsAdmin.data, null, 2))
  }
}

run().catch((err) => {
  console.error('Unexpected error:', err)
  process.exit(5)
})
