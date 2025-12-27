import createServerSupabaseClient from '@/lib/supabase/server'

export async function ensureWorkspaceForUser(userId: string, email?: string) {
  const admin = createServerSupabaseClient()

  try {
    // Ensure public.users record exists for userId (idempotent)
    try {
      const { data: existingUser, error: userCheckErr } = await admin
        .from('users')
        .select('id')
        .eq('id', userId)
        .limit(1)
      if (userCheckErr) {
        // ignore: some projects keep auth-managed users; continue
      } else if (!existingUser || existingUser.length === 0) {
        await admin.from('users').insert({ id: userId, email: email || null }).limit(1)
      }
    } catch (uErr) {
      // best-effort only; log and continue
      console.warn('[ensureWorkspaceForUser] user provisioning best-effort failed:', uErr)
    }
    // Check for existing workspace (support both `owner` and `owner_id` columns)
    const { data: existing, error: checkErr } = await admin
      .from('workspaces')
      .select('*')
      .or(`owner.eq.${userId},owner_id.eq.${userId}`)
      .limit(1)

    if (checkErr) {
      console.error('[ensureWorkspaceForUser] Failed to check workspaces:', checkErr)
      throw checkErr
    }

    if (existing && existing.length > 0) {
      return { created: false, workspace: existing[0] }
    }

    const name = email ? `${email}'s Workspace` : 'My Workspace'

    // Create workspace using service role (admin client)
    const { data: createdWs, error: createWsErr } = await admin
      .from('workspaces')
      .insert({
        name,
        owner: userId,
        plan_type: 'free',
        subscription_status: 'active'
      })
      .select()
      .limit(1)
      .single()

    if (createWsErr) {
      // Handle potential race / duplicate creation by reading back existing row
      console.error('[ensureWorkspaceForUser] Workspace create error:', createWsErr)
      const { data: existing2 } = await admin
        .from('workspaces')
        .select('*')
        .or(`owner.eq.${userId},owner_id.eq.${userId}`)
        .limit(1)
      if (existing2 && existing2.length > 0) {
        return { created: false, workspace: existing2[0] }
      }
      throw createWsErr
    }

    // Ensure membership exists (idempotent upsert).
    // Try to create as `owner` first; if DB check constraint prevents `owner`, fall back to `admin`.
    const membershipOwner = {
      workspace_id: createdWs.id,
      user_id: userId,
      role: 'owner'
    }

    let memberErr = null
    try {
      const res = await admin
        .from('workspace_members')
        .upsert([membershipOwner], { onConflict: 'workspace_id,user_id' })
      memberErr = res.error
      if (memberErr) {
        throw memberErr
      }
    } catch (mErr: any) {
      // If check constraint blocks 'owner', retry with 'admin'
      if (mErr && (mErr.code === '23514' || (mErr.message && mErr.message.includes('role')))) {
        console.warn('[ensureWorkspaceForUser] role `owner` rejected by DB; retrying as `admin`')
        const membershipAdmin = {
          workspace_id: createdWs.id,
          user_id: userId,
          role: 'admin'
        }
        const { error: retryErr } = await admin
          .from('workspace_members')
          .upsert([membershipAdmin], { onConflict: 'workspace_id,user_id' })
        if (retryErr) {
          console.error('[ensureWorkspaceForUser] Failed to upsert membership as admin:', retryErr)
        }
      } else {
        console.error('[ensureWorkspaceForUser] Failed to upsert membership:', mErr)
      }
    }

    console.log(`[ensureWorkspaceForUser] Auto-created workspace ${createdWs.id} for user ${userId}`)
    return { created: true, workspace: createdWs }
  } catch (err) {
    console.error('[ensureWorkspaceForUser] Unexpected error:', err)
    throw err
  }
}

export default ensureWorkspaceForUser
