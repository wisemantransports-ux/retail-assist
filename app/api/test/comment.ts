import { NextRequest, NextResponse } from 'next/server';
import { detectCommentEvent } from '@/lib/meta/comment';
import { runCommentAutomationTest } from '@/lib/automation/comment/runCommentAutomationTest';
import { createServerSupabaseClient } from '@/lib/supabase/server';

export async function POST(req: NextRequest) {
  const body = await req.json();
  const { isComment, platform, data } = detectCommentEvent(body);
  if (!isComment || !data) {
    return NextResponse.json({ ok: true, ignored: true });
  }
  // Find workspace by pageId
  const supabase = await createServerSupabaseClient();
  const { data: workspace } = await supabase
    .from('workspaces')
    .select('id, meta_page_id')
    .eq('meta_page_id', data.pageId)
    .single();
  if (!workspace) {
    return NextResponse.json({ ok: false, error: 'Workspace not found' }, { status: 404 });
  }

  // Get automation rule
  const { data: rule } = await supabase
    .from('comment_automation_rules')
    .select('*')
    .eq('workspace_id', workspace.id)
    .eq('enabled', true)
    .maybeSingle();
  if (!rule) {
    return NextResponse.json({ ok: true, ignored: true, reason: 'No automation rule' });
  }

  // Run test automation logic
  const result = await runCommentAutomationTest({
    workspaceId: workspace.id,
    comment: data,
    rule,
    // aiAgent: optional, can be injected here
  });
  return NextResponse.json(result);
}
