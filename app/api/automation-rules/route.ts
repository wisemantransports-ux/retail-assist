import { NextResponse } from 'next/server';
import { createServerClient } from '@/lib/supabase/server';
import { checkWorkspaceActive } from '@/lib/supabase/subscriptionCheck';
import { validateCreateInput, validateUpdateInput } from '@/lib/automation/validation';
import { env } from '@/lib/env';

/**
 * GET /api/automation-rules
 * List all automation rules for the authenticated user's workspace
 * 
 * Query params:
 * - agentId: filter by agent ID (optional)
 * - enabledOnly: only return enabled rules (optional, default false)
 */
export async function GET(request: Request) {
  try {
    if (env.useMockMode) {
      return NextResponse.json({
        rules: [
          {
            id: 'mock_rule_1',
            workspace_id: 'mock_workspace',
            agent_id: 'mock_agent',
            name: 'Comment to DM',
            type: 'comment_to_dm',
            enabled: true,
            created_at: new Date().toISOString(),
          },
        ],
      });
    }

    const supabase = await createServerClient();
    const { data: { session } } = await supabase.auth.getSession();
    
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Get user's workspace
    const { data: workspace, error: workspaceError } = await supabase
      .from('workspaces')
      .select('id')
      .eq('owner_id', session.user.id)
      .limit(1)
      .single();

    if (workspaceError || !workspace) {
      return NextResponse.json({ rules: [] });
    }

    // Parse query params
    const url = new URL(request.url);
    const agentId = url.searchParams.get('agentId');
    const enabledOnly = url.searchParams.get('enabledOnly') === 'true';

    // Build query
    let query = supabase
      .from('automation_rules')
      .select('*')
      .eq('workspace_id', workspace.id);

    if (agentId) {
      query = query.eq('agent_id', agentId);
    }

    if (enabledOnly) {
      query = query.eq('enabled', true);
    }

    const { data: rules, error } = await query.order('created_at', { ascending: false });

    if (error) {
      console.error('Failed to fetch automation rules:', error);
      return NextResponse.json(
        { error: 'Failed to fetch automation rules' },
        { status: 500 }
      );
    }

    return NextResponse.json({ rules: rules || [] });
  } catch (err: any) {
    console.error('Error in GET /api/automation-rules:', err);
    return NextResponse.json({ error: err.message || 'Server error' }, { status: 500 });
  }
}

/**
 * POST /api/automation-rules
 * Create a new automation rule
 * 
 * Body:
 * {
 *   "name": "My Rule",
 *   "description": "Optional description",
 *   "agent_id": "uuid",
 *   "type": "comment_to_dm" | "keyword_reply" | "scheduled_message",
 *   "trigger_type": "comment" | "keyword" | "time" | "manual",
 *   "trigger_words": ["hello", "hi"],
 *   "trigger_platforms": ["facebook", "instagram"],
 *   "action_type": "send_dm" | "send_public_reply" | "send_email",
 *   "send_public_reply": false,
 *   "public_reply_template": "...",
 *   "send_private_reply": true,
 *   "private_reply_template": "...",
 *   "auto_skip_replies": true,
 *   "skip_if_keyword_present": ["already replied"],
 *   "delay_seconds": 0,
 *   "enabled": true
 * }
 */
export async function POST(request: Request) {
  try {
    if (env.useMockMode) {
      const body = await request.json();
      const validation = validateCreateInput(body);
      
      if (!validation.valid) {
        return NextResponse.json(
          { error: validation.error },
          { status: 400 }
        );
      }

      return NextResponse.json({
        rule: {
          id: `rule_${Date.now()}`,
          workspace_id: 'mock_workspace',
          name: body.name,
          agent_id: body.agent_id,
          type: body.type,
          trigger_type: body.trigger_type,
          action_type: body.action_type,
          enabled: body.enabled !== false,
          created_at: new Date().toISOString(),
        },
      }, { status: 201 });
    }

    const supabase = await createServerClient();
    const { data: { session } } = await supabase.auth.getSession();

    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();

    // Validate input
    const validation = validateCreateInput(body);
    if (!validation.valid) {
      return NextResponse.json(
        { error: validation.error },
        { status: 400 }
      );
    }

    // Get user's workspace
    const { data: workspace, error: workspaceError } = await supabase
      .from('workspaces')
      .select('id')
      .eq('owner_id', session.user.id)
      .limit(1)
      .single();

    if (workspaceError || !workspace) {
      return NextResponse.json(
        { error: 'No workspace found' },
        { status: 400 }
      );
    }

    // Verify user has access to workspace
    const { data: member } = await supabase
      .from('workspace_members')
      .select('role')
      .eq('workspace_id', workspace.id)
      .eq('user_id', session.user.id)
      .single();

    if (!member) {
      return NextResponse.json(
        { error: 'No access to workspace' },
        { status: 403 }
      );
    }

    // Check workspace subscription status
    const subStatus = await checkWorkspaceActive(supabase, workspace.id);
    if (!subStatus.active) {
      return NextResponse.json(
        { error: subStatus.error || 'Workspace subscription is not active' },
        { status: 403 }
      );
    }

    // Verify agent exists and belongs to workspace
    const { data: agent, error: agentError } = await supabase
      .from('agents')
      .select('id')
      .eq('id', body.agent_id)
      .eq('workspace_id', workspace.id)
      .single();

    if (agentError || !agent) {
      return NextResponse.json(
        { error: 'Agent not found or does not belong to this workspace' },
        { status: 404 }
      );
    }

    // Create automation rule
    const { data: rule, error: createError } = await supabase
      .from('automation_rules')
      .insert([
        {
          workspace_id: workspace.id,
          agent_id: body.agent_id,
          name: body.name,
          description: body.description || null,
          type: body.type,
          enabled: body.enabled !== false,
          trigger_type: body.trigger_type,
          trigger_words: body.trigger_words || [],
          trigger_platforms: body.trigger_platforms || ['facebook', 'instagram'],
          action_type: body.action_type,
          send_public_reply: body.send_public_reply || false,
          public_reply_template: body.public_reply_template || null,
          send_private_reply: body.send_private_reply !== false,
          private_reply_template: body.private_reply_template || null,
          auto_skip_replies: body.auto_skip_replies !== false,
          skip_if_keyword_present: body.skip_if_keyword_present || [],
          delay_seconds: body.delay_seconds || 0,
        },
      ])
      .select()
      .single();

    if (createError || !rule) {
      console.error('Failed to create automation rule:', createError);
      return NextResponse.json(
        { error: 'Failed to create automation rule' },
        { status: 500 }
      );
    }

    return NextResponse.json({ rule }, { status: 201 });
  } catch (err: any) {
    console.error('Error in POST /api/automation-rules:', err);
    return NextResponse.json(
      { error: err.message || 'Server error' },
      { status: 500 }
    );
  }
}
