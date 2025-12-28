/**
 * Subscription Status Check Utility
 * Verifies workspace has active subscription before allowing writes
 */

import { SupabaseClient } from '@supabase/supabase-js';

export async function checkWorkspaceActive(
  supabase: SupabaseClient,
  workspaceId: string
): Promise<{ active: boolean; error?: string }> {
  try {
    const { data: workspace, error } = await supabase
      .from('workspaces')
      .select('subscription_status')
      .eq('id', workspaceId)
      .single();

    if (error || !workspace) {
      return {
        active: false,
        error: `Workspace not found`,
      };
    }

    const isActive = workspace.subscription_status === 'active';
    return {
      active: isActive,
      error: isActive ? undefined : `Workspace subscription is not active (status: ${workspace.subscription_status})`,
    };
  } catch (err: any) {
    return {
      active: false,
      error: `Failed to check workspace status: ${err.message}`,
    };
  }
}
