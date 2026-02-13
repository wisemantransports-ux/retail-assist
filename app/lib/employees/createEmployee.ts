'use client';

import { createBrowserSupabaseClient } from '@/lib/supabase/client';

export type InviterRole = 'super_admin' | 'admin';

export async function createEmployee({
  email,
  fullName,
  invitedByRole,
  workspaceId,
}: {
  email: string;
  fullName?: string;
  invitedByRole: InviterRole;
  workspaceId?: string | null;
}) {
  // Enforce inviter rules on the client to avoid accidental API misuse
  if (invitedByRole === 'super_admin') {
    // Super admin invites → workspace_id must be null
    workspaceId = null;
  } else if (invitedByRole === 'admin') {
    // Client admin invites → workspace_id required
    if (!workspaceId) throw new Error('Client admin must assign a workspace');
  } else {
    throw new Error('Invalid inviter role');
  }

  const supabase = createBrowserSupabaseClient();

  const { data, error } = await supabase.from('employees').insert({
    email,
    full_name: fullName || null,
    role: 'employee',
    workspace_id: workspaceId === undefined ? null : workspaceId,
  }).select().limit(1).maybeSingle();

  if (error) throw error;
  return data;
}
