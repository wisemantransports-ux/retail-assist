import { NextResponse } from 'next/server';
import { createServerSupabaseClient, createAdminSupabaseClient } from '@/lib/supabase/server';
import { createAgent, getCurrentUser } from '@/lib/supabase/queries';
import { generateApiKey } from '@/lib/utils/helpers';
import { env } from '@/lib/env';

/**
 * GET /api/agents
 * Get all agents for the authenticated user's workspace
 */
export async function GET(request: Request) {
  try {
    if (env.useMockMode) {
      // Return mock agents for development
      return NextResponse.json({
        agents: [
          {
            id: 'mock_1',
            name: 'Sales Assistant',
            system_prompt: 'You are a helpful sales representative...',
            created_at: new Date().toISOString(),
          },
        ],
      });
    }

    const supabase = await createServerSupabaseClient();
    const { data: { session } } = await supabase.auth.getSession();
    
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Get user's default workspace
    const { data: workspace, error: workspaceError } = await supabase
      .from('workspaces')
      .select('id')
      .eq('owner_id', session.user.id)
      .limit(1)
      .single();

    if (workspaceError || !workspace) {
      return NextResponse.json({ agents: [] });
    }

    // Get agents for this workspace
    const { data: agents, error } = await supabase
      .from('agents')
      .select('*')
      .eq('workspace_id', workspace.id)
      .is('deleted_at', null)
      .order('created_at', { ascending: false });

    if (error) {
      console.error('Failed to fetch agents:', error);
      return NextResponse.json({ error: 'Failed to fetch agents' }, { status: 500 });
    }

    return NextResponse.json({ agents: agents || [] });
  } catch (err: any) {
    console.error('Error in GET /api/agents:', err);
    return NextResponse.json({ error: err.message || 'Server error' }, { status: 500 });
  }
}

/**
 * POST /api/agents
 * Create a new agent
 */
export async function POST(request: Request) {
  try {
    // Handle mock mode
    if (env.useMockMode) {
      const body = await request.json();
      const { name, systemPrompt } = body;

      return NextResponse.json({
        agent: {
          id: `agent_${Date.now()}`,
          name,
          system_prompt: systemPrompt,
          api_key: generateApiKey(40),
          created_at: new Date().toISOString(),
        },
      });
    }

    const supabase = await createServerSupabaseClient();
    const { data: { session } } = await supabase.auth.getSession();

    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const { name, systemPrompt, greeting, fallback, model, workspaceId } = body;

    // Validate required fields
    if (!name || !systemPrompt) {
      return NextResponse.json(
        { error: 'Name and system prompt are required' },
        { status: 400 }
      );
    }

    // Get user's workspace if not specified
    let workspace_id = workspaceId;
    if (!workspace_id) {
      const { data: workspace } = await supabase
        .from('workspaces')
        .select('id')
        .eq('owner_id', session.user.id)
        .limit(1)
        .single();

      if (!workspace) {
        return NextResponse.json(
          { error: 'No workspace found' },
          { status: 400 }
        );
      }
      workspace_id = workspace.id;
    }

    // Verify user has access to workspace
    const { data: member } = await supabase
      .from('workspace_members')
      .select('role')
      .eq('workspace_id', workspace_id)
      .eq('user_id', session.user.id)
      .single();

    if (!member) {
      return NextResponse.json(
        { error: 'No access to workspace' },
        { status: 403 }
      );
    }

    // Create agent with real database
    const agent = await createAgent(workspace_id, {
      name,
      system_prompt: systemPrompt,
      greeting,
      fallback,
      model: model || 'gpt-4o-mini',
    });

    if (!agent) {
      return NextResponse.json(
        { error: 'Failed to create agent' },
        { status: 500 }
      );
    }


    return NextResponse.json({ agent }, { status: 201 });
  } catch (err: any) {
    console.error('Error in POST /api/agents:', err);
    return NextResponse.json(
      { error: err.message || 'Server error' },
      { status: 500 }
    );
  }
}
