import { NextResponse } from 'next/server';
import { createServerClient } from '@/lib/supabase/server';
import { resolveUserId } from '@/lib/supabase/queries';
import { checkWorkspaceActive } from '@/lib/supabase/subscriptionCheck';
import { validateUpdateInput } from '@/lib/automation/validation';
import { env } from '@/lib/env';

/**
 * Helper: Get rule and verify workspace access
 */
async function getRuleWithWorkspaceCheck(
  supabase: any,
  ruleId: string,
  userId: string
): Promise<{ rule: any; workspace: any; error?: string }> {
  // Get the rule
  const { data: rule, error: ruleError } = await supabase
    .from('automation_rules')
    .select('*')
    .eq('id', ruleId)
    .single();

  if (ruleError || !rule) {
    return { rule: null, workspace: null, error: 'Rule not found' };
  }

  // Verify user is member of the workspace
  const { data: member, error: memberError } = await supabase
    .from('workspace_members')
    .select('id')
    .eq('workspace_id', rule.workspace_id)
    .eq('user_id', userId)
    .single();

  if (memberError || !member) {
    return { rule: null, workspace: null, error: 'No access to this rule' };
  }

  // Get workspace for subscription check
  const { data: workspace } = await supabase
    .from('workspaces')
    .select('*')
    .eq('id', rule.workspace_id)
    .single();

  return { rule, workspace };
}

/**
 * GET /api/automation-rules/[id]
 * Fetch a single automation rule
 */
export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    if (env.useMockMode) {
      return NextResponse.json({
        rule: {
          id,
          workspace_id: 'mock_workspace',
          agent_id: 'mock_agent',
          name: 'Mock Rule',
          type: 'comment_to_dm',
          enabled: true,
          created_at: new Date().toISOString(),
        },
      });
    }

    const supabase = await createServerClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const effectiveUserId = (await resolveUserId(user.id, false)) || user.id
    const { rule, error } = await getRuleWithWorkspaceCheck(supabase, id, effectiveUserId);

    if (error) {
      return NextResponse.json({ error }, { status: error === 'Rule not found' ? 404 : 403 });
    }

    return NextResponse.json({ rule });
  } catch (err: any) {
    console.error('Error in GET /api/automation-rules/[id]:', err);
    return NextResponse.json({ error: err.message || 'Server error' }, { status: 500 });
  }
}

/**
 * PATCH /api/automation-rules/[id]
 * Update an automation rule
 * 
 * Body: Any fields from automation_rules table (all optional)
 */
export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    if (env.useMockMode) {
      const body = await request.json();
      const validation = validateUpdateInput(body);

      if (!validation.valid) {
        return NextResponse.json({ error: validation.error }, { status: 400 });
      }

      return NextResponse.json({
        rule: {
          id,
          ...body,
          updated_at: new Date().toISOString(),
        },
      });
    }

    const supabase = await createServerClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();

    // Validate input
    const validation = validateUpdateInput(body);
    if (!validation.valid) {
      return NextResponse.json({ error: validation.error }, { status: 400 });
    }

    const effectiveUserId2 = (await resolveUserId(user.id, false)) || user.id
    const { rule, workspace, error } = await getRuleWithWorkspaceCheck(
      supabase,
      id,
      effectiveUserId2
    );

    if (error) {
      return NextResponse.json({ error }, { status: error === 'Rule not found' ? 404 : 403 });
    }

    // Check workspace subscription status
    const subStatus = await checkWorkspaceActive(supabase, rule.workspace_id);
    if (!subStatus.active) {
      return NextResponse.json(
        { error: subStatus.error || 'Workspace subscription is not active' },
        { status: 403 }
      );
    }

    // If updating agent_id, verify the agent exists and belongs to workspace
    if (body.agent_id && body.agent_id !== rule.agent_id) {
      const { data: agent, error: agentError } = await supabase
        .from('agents')
        .select('id')
        .eq('id', body.agent_id)
        .eq('workspace_id', rule.workspace_id)
        .single();

      if (agentError || !agent) {
        return NextResponse.json(
          { error: 'New agent does not exist or does not belong to this workspace' },
          { status: 404 }
        );
      }
    }

    // Update rule
    const { data: updated, error: updateError } = await supabase
      .from('automation_rules')
      .update(body)
      .eq('id', id)
      .select()
      .single();

    if (updateError || !updated) {
      console.error('Failed to update automation rule:', updateError);
      return NextResponse.json(
        { error: 'Failed to update automation rule' },
        { status: 500 }
      );
    }

    return NextResponse.json({ rule: updated });
  } catch (err: any) {
    console.error('Error in PATCH /api/automation-rules/[id]:', err);
    return NextResponse.json({ error: err.message || 'Server error' }, { status: 500 });
  }
}

/**
 * DELETE /api/automation-rules/[id]
 * Delete an automation rule (hard delete)
 */
export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    if (env.useMockMode) {
      return NextResponse.json({ success: true });
    }

    const supabase = await createServerClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const effectiveUserId3 = (await resolveUserId(user.id, false)) || user.id
    const { rule, error } = await getRuleWithWorkspaceCheck(supabase, id, effectiveUserId3);

    if (error) {
      return NextResponse.json({ error }, { status: error === 'Rule not found' ? 404 : 403 });
    }

    // Check workspace subscription status
    const subStatus = await checkWorkspaceActive(supabase, rule.workspace_id);
    if (!subStatus.active) {
      return NextResponse.json(
        { error: subStatus.error || 'Workspace subscription is not active' },
        { status: 403 }
      );
    }

    // Delete rule
    const { error: deleteError } = await supabase
      .from('automation_rules')
      .delete()
      .eq('id', id);

    if (deleteError) {
      console.error('Failed to delete automation rule:', deleteError);
      return NextResponse.json(
        { error: 'Failed to delete automation rule' },
        { status: 500 }
      );
    }

    return NextResponse.json({ success: true });
  } catch (err: any) {
    console.error('Error in DELETE /api/automation-rules/[id]:', err);
    return NextResponse.json({ error: err.message || 'Server error' }, { status: 500 });
  }
}
