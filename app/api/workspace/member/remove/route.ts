import { createServerClient } from '@/lib/supabase/server';
import { removeMember } from '@/lib/supabase/queries';
import { NextRequest, NextResponse } from 'next/server';

/**
 * POST /api/workspace/member/remove
 * Remove a member from a workspace
 * 
 * Body:
 * {
 *   "workspace_id": "uuid",
 *   "member_id": "uuid"
 * }
 */
export async function POST(request: NextRequest) {
  try {
    const supabase = createServerClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const { workspace_id, member_id } = await request.json();

    // Validation
    if (!workspace_id || !member_id) {
      return NextResponse.json(
        { error: 'Missing required fields: workspace_id, member_id' },
        { status: 400 }
      );
    }

    console.log(`[team-api] Removing member ${member_id} from workspace ${workspace_id}`);

    // Remove member
    const result = await removeMember(workspace_id, member_id, user.id);

    if (result.error) {
      console.error('[team-api] Error removing member:', result.error);
      return NextResponse.json(
        { error: result.error },
        { status: 400 }
      );
    }

    return NextResponse.json({
      success: true,
      message: 'Member removed successfully',
    });
  } catch (error) {
    console.error('[team-api] Error in POST /api/workspace/member/remove:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
