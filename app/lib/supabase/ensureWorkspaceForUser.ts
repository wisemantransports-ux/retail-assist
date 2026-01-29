import { createClient } from '@supabase/supabase-js';
import { ensureInternalUser } from './queries';

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
 * Uses service role client to bypass RLS policies.
 * Creates fresh client instances to avoid schema cache issues.
 * Safe to call multiple times (idempotent via CONFLICT handling)
 */
export async function ensureWorkspaceForUser(userId: string): Promise<EnsureWorkspaceResult> {
  try {
    if (!userId) {
      return { workspaceId: '', created: false, error: 'Missing userId' };
    }

    // Create fresh service role clients (bypass schema cache issues)
    const supabaseUrl = process.env.SUPABASE_URL;
    const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
    
    if (!supabaseUrl || !serviceRoleKey) {
      return { 
        workspaceId: '', 
        created: false, 
        error: 'Supabase configuration missing' 
      };
    }

    // Ensure there is an internal users.id for this auth UID (create if missing)
    const ensured = await ensureInternalUser(userId)
    const internalUserId = ensured.id
    if (!internalUserId) {
      return { workspaceId: '', created: false, error: 'Failed to ensure internal user record' }
    }

    // Create a fresh admin client for checking existing memberships
    const adminCheckClient = createClient(supabaseUrl, serviceRoleKey, {
      auth: { autoRefreshToken: false, persistSession: false }
    });

    // Check if user has any workspace membership
    const { data: existingMemberships } = await adminCheckClient
      .from('workspace_members')
      .select('workspace_id')
      .eq('user_id', internalUserId)
      .limit(1);

    if (existingMemberships && existingMemberships.length > 0) {
      // User already has a workspace
      return {
        workspaceId: existingMemberships[0].workspace_id,
        created: false,
      };
    }

    // Create a fresh admin client for workspace creation
    const adminCreateClient = createClient(supabaseUrl, serviceRoleKey, {
      auth: { autoRefreshToken: false, persistSession: false }
    });

    // Attempt to create default workspace
    const workspaceName = `My Workspace`;
    let newWorkspace = null;
    let createdNewWorkspace = false;

    const { data: createResult, error: createWorkspaceError } = await adminCreateClient
      .from('workspaces')
      .insert([
        {
          owner_id: internalUserId,
          name: workspaceName,
        },
      ])
      .select()
      .single();

    // Handle workspace creation result
    if (createResult) {
      // Successfully created a new workspace
      newWorkspace = createResult;
      createdNewWorkspace = true;
    } else if (createWorkspaceError) {
      // Check if error is due to duplicate workspace name
      const errorMessage = createWorkspaceError?.message || '';
      const isDuplicateNameError = 
        errorMessage.includes('duplicate') || 
        errorMessage.includes('unique') ||
        errorMessage.includes('violates');

      if (isDuplicateNameError) {
        // Workspace with this name already exists - fetch it
        console.log('[ensureWorkspaceForUser] Duplicate workspace name detected, fetching existing...');
        const { data: existingWorkspace } = await adminCreateClient
          .from('workspaces')
          .select('*')
          .eq('name', workspaceName)
          .single();

        if (existingWorkspace) {
          newWorkspace = existingWorkspace;
          createdNewWorkspace = false;
          console.log('[ensureWorkspaceForUser] Reusing existing workspace:', newWorkspace.id);
        } else {
          return {
            workspaceId: '',
            created: false,
            error: `Workspace creation failed and could not find existing workspace with name "${workspaceName}"`,
          };
        }
      } else {
        // Other creation error
        return {
          workspaceId: '',
          created: false,
          error: `Failed to create workspace: ${createWorkspaceError.message}`,
        };
      }
    }

    if (!newWorkspace) {
      return {
        workspaceId: '',
        created: false,
        error: 'Failed to create or locate workspace',
      };
    }

    // Create a fresh admin client for membership operations
    const adminMemberClient = createClient(supabaseUrl, serviceRoleKey, {
      auth: { autoRefreshToken: false, persistSession: false }
    });

    // Add user as admin member (idempotent - ignore if already exists)
    console.log('[ensureWorkspaceForUser] Inserting workspace_members: user_id=', internalUserId, 'workspace_id=', newWorkspace.id);
    const { error: memberError } = await adminMemberClient
      .from('workspace_members')
      .insert([
        {
          workspace_id: newWorkspace.id,
          user_id: internalUserId,
          role: 'admin',
        },
      ]);

    // Only treat as error if it's NOT a duplicate key error
    if (memberError) {
      console.log('[ensureWorkspaceForUser] memberError details:', memberError);
      const isDuplicateError = 
        memberError.message?.includes('duplicate') || 
        memberError.message?.includes('unique') ||
        memberError.code === '23505'; // PostgreSQL unique violation
      
      if (!isDuplicateError) {
        console.error('[ensureWorkspaceForUser] Failed to add membership:', memberError.message);
        return {
          workspaceId: newWorkspace.id,
          created: createdNewWorkspace,
          error: `Workspace created but failed to add membership: ${memberError.message}`,
        };
      }
      // If it's a duplicate, that's fine - user is already a member
      console.log('[ensureWorkspaceForUser] User already a member of workspace, continuing...');
    } else {
      console.log('[ensureWorkspaceForUser] ✓ workspace_members entry created/confirmed');
    }

    // Create a fresh admin client for admin_access operations
    const adminAccessClient = createClient(supabaseUrl, serviceRoleKey, {
      auth: { autoRefreshToken: false, persistSession: false }
    });

    // Create admin_access entry so user can access as admin (idempotent)
    console.log('[ensureWorkspaceForUser] Inserting admin_access: user_id=', internalUserId, 'workspace_id=', newWorkspace.id);
    const { error: adminAccessError } = await adminAccessClient
      .from('admin_access')
      .insert([
        {
          workspace_id: newWorkspace.id,
          user_id: internalUserId,
          role: 'admin',
        },
      ]);

    // Only treat as error if it's NOT a duplicate key error
    if (adminAccessError) {
      console.log('[ensureWorkspaceForUser] adminAccessError details:', adminAccessError);
      const isDuplicateError = 
        adminAccessError.message?.includes('duplicate') || 
        adminAccessError.message?.includes('unique') ||
        adminAccessError.code === '23505'; // PostgreSQL unique violation
      
      if (!isDuplicateError) {
        console.error('[ensureWorkspaceForUser] Failed to add admin access:', adminAccessError.message);
        return {
          workspaceId: newWorkspace.id,
          created: createdNewWorkspace,
          error: `Workspace created but failed to add admin access: ${adminAccessError.message}`,
        };
      }
      // If it's a duplicate, that's fine - user already has admin access
      console.log('[ensureWorkspaceForUser] User already has admin access, continuing...');
    } else {
      console.log('[ensureWorkspaceForUser] ✓ admin_access entry created/confirmed');
    }

    console.log('[ensureWorkspaceForUser] ✓ Workspace provisioning complete for workspace_id:', newWorkspace.id);
    return {
      workspaceId: newWorkspace.id,
      created: createdNewWorkspace,
    };
  } catch (err: any) {
    return {
      workspaceId: '',
      created: false,
      error: `Unexpected error: ${err.message}`,
    };
  }
}
