/**
 * POST /api/automation/comment-handler
 * Main entry point for comment automation
 * 
 * Handles:
 * - Facebook webhook events (when integrated)
 * - Mock comment events (for development/testing)
 * - Comment detection, storage, rule checking, and reply generation
 */

import { NextResponse } from 'next/server';
import { detectCommentEvent } from '@/lib/meta/comment';
import { runCommentAutomation } from '@/lib/automation/comment/runCommentAutomation';
import { createAdminSupabaseClient, createMockAdminSupabaseClient } from '@/lib/supabase/server';
import { getAutomationRules, getAgentById } from '@/lib/supabase/queries';
import { env } from '@/lib/env';
import type { AutomationRule, Agent } from '@/lib/types/database';

export async function POST(request: Request) {
  try {
    const body = await request.json();
    console.log('[Comment Handler] Received webhook/request:', JSON.stringify(body, null, 2));

    // Step 1: Detect comment event from webhook
    const { isComment, platform, data: commentData } = detectCommentEvent(body);

    if (!isComment || !commentData) {
      console.log('[Comment Handler] Not a comment event, ignoring');
      return NextResponse.json({ ok: true, ignored: true, reason: 'Not a comment event' });
    }

    console.log('[Comment Handler] Detected comment from platform:', platform);

    // Step 2: Find workspace by pageId (Facebook) or workspaceId (mock)
    const useMock = env.useMockMode;
    const supabase = useMock ? await createMockAdminSupabaseClient() : await createAdminSupabaseClient();

    let workspaceId: string | null = null;

    if (commentData.pageId) {
      // Look up workspace by Facebook page ID
      const { data: workspace } = await supabase
        .from('workspaces')
        .select('id')
        .eq('meta_page_id', commentData.pageId)
        .maybeSingle();

      if (workspace) {
        workspaceId = workspace.id;
      }
    } else if (body.workspaceId) {
      // For mock/test requests, workspaceId can be provided directly
      workspaceId = body.workspaceId;
    }

    if (!workspaceId) {
      console.warn('[Comment Handler] Workspace not found for page:', commentData.pageId);
      return NextResponse.json(
        { ok: false, error: 'Workspace not found' },
        { status: 404 }
      );
    }

    console.log('[Comment Handler] Found workspace:', workspaceId);

    // Step 3: Get agent (use agentId from request or find first enabled agent)
    let agentId = body.agentId;
    let agent: Agent | null = null;

    if (!agentId) {
      // Get first agent for this workspace
      const { data: agents } = await supabase
        .from('agents')
        .select('id')
        .eq('workspace_id', workspaceId)
        .eq('enabled', true)
        .is('deleted_at', null)
        .limit(1)
        .maybeSingle();

      if (agents) {
        agentId = agents.id;
      }
    }

    if (agentId) {
      agent = await getAgentById(agentId);
    }

    if (!agentId || !agent) {
      console.warn('[Comment Handler] No agent found for workspace:', workspaceId);
      return NextResponse.json(
        { ok: false, error: 'No agent configured for this workspace' },
        { status: 400 }
      );
    }

    console.log('[Comment Handler] Using agent:', agentId);

    // Step 4: Get automation rules for this agent/workspace
    const rules = await getAutomationRules(workspaceId, agentId);

    if (!rules || rules.length === 0) {
      console.log('[Comment Handler] No automation rules found');
      return NextResponse.json({
        ok: true,
        ignored: true,
        commentId: commentData.commentId,
        reason: 'No automation rules enabled',
      });
    }

    // Step 5: Apply first matching rule
    // In future, could filter by trigger_words or other criteria
    const rule = rules[0] as AutomationRule;

    console.log('[Comment Handler] Found automation rule:', rule.id);

    // Step 6: Execute automation
    const result = await runCommentAutomation({
      workspaceId,
      agentId,
      comment: commentData,
      rule,
      pageAccessToken: body.pageAccessToken || undefined,
      agent,
    });

    console.log('[Comment Handler] Automation result:', result);

    // Return appropriate response
    if (result.ok && result.processed) {
      return NextResponse.json({
        ok: true,
        processed: true,
        commentId: result.commentId,
        publicReplyId: result.publicReplyId,
        dmSent: result.dmSent,
      });
    } else if (result.ok) {
      return NextResponse.json({
        ok: true,
        processed: false,
        commentId: result.commentId,
        reason: result.details,
      });
    } else {
      return NextResponse.json(
        {
          ok: false,
          error: result.error,
          details: result.details,
        },
        { status: 500 }
      );
    }
  } catch (error: any) {
    console.error('[Comment Handler] Unexpected error:', error);
    return NextResponse.json(
      {
        ok: false,
        error: error.message || 'Internal server error',
      },
      { status: 500 }
    );
  }
}

/**
 * GET /api/automation/comment-handler
 * Health check / test endpoint
 */
export async function GET(request: Request) {
  return NextResponse.json({
    ok: true,
    status: 'Comment automation handler is running',
    mode: env.useMockMode ? 'mock' : 'production',
  });
}
