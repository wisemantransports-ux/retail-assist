import { updateAutomationRule, deleteAutomationRule } from '@/lib/supabase/queries';
import { createServerSupabaseClient } from '@/lib/supabase/server';
import { checkWorkspaceActive } from '@/lib/supabase/subscriptionCheck';
import { NextRequest, NextResponse } from 'next/server';

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ ruleId: string }> }
) {
  try {
    const { ruleId } = await params;
    const body = await request.json();

    // Check authentication and workspace subscription
    const supabase = await createServerSupabaseClient();
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Get rule to find workspace
    const { data: rule, error: ruleError } = await supabase
      .from('automation_rules')
      .select('workspace_id')
      .eq('id', ruleId)
      .single();

    if (ruleError || !rule) {
      return NextResponse.json({ error: 'Rule not found' }, { status: 404 });
    }

    // Verify workspace is active
    const subStatus = await checkWorkspaceActive(supabase, rule.workspace_id);
    if (!subStatus.active) {
      return NextResponse.json(
        { error: subStatus.error || 'Workspace subscription is not active' },
        { status: 403 }
      );
    }

    const success = await updateAutomationRule(ruleId, body);
    
    if (success) {
      return Response.json({ success: true });
    } else {
      return Response.json({ error: 'Failed to update rule' }, { status: 500 });
    }
  } catch (error: any) {
    console.error('Failed to update rule:', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ ruleId: string }> }
) {
  try {
    const { ruleId } = await params;

    // Check authentication and workspace subscription
    const supabase = await createServerSupabaseClient();
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Get rule to find workspace
    const { data: rule, error: ruleError } = await supabase
      .from('automation_rules')
      .select('workspace_id')
      .eq('id', ruleId)
      .single();

    if (ruleError || !rule) {
      return NextResponse.json({ error: 'Rule not found' }, { status: 404 });
    }

    // Verify workspace is active
    const subStatus = await checkWorkspaceActive(supabase, rule.workspace_id);
    if (!subStatus.active) {
      return NextResponse.json(
        { error: subStatus.error || 'Workspace subscription is not active' },
        { status: 403 }
      );
    }

    const success = await deleteAutomationRule(ruleId);
    
    if (success) {
      return Response.json({ success: true });
    } else {
      return Response.json({ error: 'Failed to delete rule' }, { status: 500 });
    }
  } catch (error: any) {
    console.error('Failed to delete rule:', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
}
