import { NextRequest, NextResponse } from 'next/server';
import { createServerSupabaseClient } from '@/lib/supabase/server';

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const workspaceId = searchParams.get('workspaceId');
  if (!workspaceId) return NextResponse.json({ error: 'Missing workspaceId' }, { status: 400 });
  const supabase = await createServerSupabaseClient();
  const { data: rule } = await supabase
    .from('comment_automation_rules')
    .select('*')
    .eq('workspace_id', workspaceId)
    .maybeSingle();
  return NextResponse.json({ rule });
}

export async function POST(req: NextRequest) {
  const body = await req.json();
  const { workspaceId, enabled, trigger_words, auto_reply_message, send_public_reply, public_reply_template } = body;
  if (!workspaceId) return NextResponse.json({ error: 'Missing workspaceId' }, { status: 400 });
  const supabase = await createServerSupabaseClient();
  const { data, error } = await supabase
    .from('comment_automation_rules')
    .upsert({
      workspace_id: workspaceId,
      enabled,
      trigger_words,
      auto_reply_message,
      send_public_reply,
      public_reply_template,
    }, { onConflict: 'workspace_id' })
    .select()
    .maybeSingle();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ rule: data });
}
