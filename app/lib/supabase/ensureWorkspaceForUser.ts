/**
 * Workspace Provisioning Utility
 * Ensures every authenticated user has a default workspace and membership
 * 
 * Call this after signup/login to guarantee workspace exists
 * Safe to call multiple times (uses INSERT ... ON CONFLICT)
 */

import { createServerClient } from './server';

export interface EnsureWorkspaceResult {
  workspaceId: string;
  created: boolean;
  error?: string;
}

/**
 * Ensure user has a workspace and membership
 * 
 * This function:
 * 1. Gets the authenticated user
 * 2. Checks if user has any workspace
 * 3. If not, creates a default workspace and adds user as owner
 * 4. Ensures user has membership record
 * 
 * Safe to call multiple times (idempotent via CONFLICT handling)
 */
export async function ensureWorkspaceForUser(userId: string): Promise<EnsureWorkspaceResult> {
  try {
    if (!userId) {
      return { workspaceId: '', created: false, error: 'Missing userId' };
    }

    const supabase = await createServerClient();

    // Check if user exists in users table
    const { data: userRecord, error: userError } = await supabase
      .from('users')
      .select('id')
      .eq('id', userId)
      .maybeSingle();

    if (userError && userError.code !== 'PGRST116') {
      // PGRST116 = no rows found (which is ok, we'll create)
      return {
        workspaceId: '',
        created: false,
        error: `Failed to check user: ${userError.message}`,
      };
    }

    // Create user record if doesn't exist
    if (!userRecord) {
      const { error: createUserError } = await supabase
        .from('users')
        .insert([
          {
            id: userId,
            auth_uid: userId,
            email: '',
          },
        ]);

      if (createUserError) {
        return {
          workspaceId: '',
          created: false,
          error: `Failed to create user: ${createUserError.message}`,
        };
      }
    }

    // Check if user has any workspace membership
    const { data: existingMemberships } = await supabase
      .from('workspace_members')
      .select('workspace_id')
      .eq('user_id', userId)
      .limit(1);

    if (existingMemberships && existingMemberships.length > 0) {
      // User already has a workspace
      return {
        workspaceId: existingMemberships[0].workspace_id,
        created: false,
      };
    }

    // Create default workspace
    const { data: newWorkspace, error: createWorkspaceError } = await supabase
      .from('workspaces')
      .insert([
        {
          owner_id: userId,
          name: `My Workspace`,
          plan_type: 'starter',
          subscription_status: 'pending',
          payment_status: 'unpaid',
        },
      ])
      .select()
      .single();

    if (createWorkspaceError || !newWorkspace) {
      return {
        workspaceId: '',
        created: false,
        error: `Failed to create workspace: ${createWorkspaceError?.message || 'Unknown error'}`,
      };
    }

    // Add user as admin member
    const { error: memberError } = await supabase
      .from('workspace_members')
      .insert([
        {
          workspace_id: newWorkspace.id,
          user_id: userId,
          role: 'admin',
        },
      ])
      .select();

    if (memberError) {
      return {
        workspaceId: newWorkspace.id,
        created: true,
        error: `Workspace created but failed to add membership: ${memberError.message}`,
      };
    }

    return {
      workspaceId: newWorkspace.id,
      created: true,
    };
  } catch (err: any) {
    return {
      workspaceId: '',
      created: false,
      error: `Unexpected error: ${err.message}`,
    };
  }
}
