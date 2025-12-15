import { createServerClient } from '@/lib/supabase/server';
import { updateMemberRole } from '@/lib/supabase/queries';
import { NextRequest, NextResponse } from 'next/server';

/**
 * POST /api/workspace/member/role
 * Update a member's role in workspace
 * 
 * Body:
 * {
 *   "workspace_id": "uuid",
 *   "member_id": "uuid",
 *   "role": "staff" | "admin" | "owner"
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

    const { workspace_id, member_id, role } = await request.json();

    // Validation
    if (!workspace_id || !member_id || !role) {
      return NextResponse.json(
        { error: 'Missing required fields: workspace_id, member_id, role' },
        { status: 400 }
      );
    }

    if (!['staff', 'admin', 'owner'].includes(role)) {
      return NextResponse.json(
        { error: 'Invalid role. Must be staff, admin, or owner' },
        { status: 400 }
      );
    }

    console.log(`[team-api] Updating member ${member_id} to role ${role}`);

    // Update member role
    const result = await updateMemberRole(workspace_id, member_id, role as any, user.id);

    if (result.error) {
      console.error('[team-api] Error updating member role:', result.error);
      return NextResponse.json(
        { error: result.error },
        { status: 400 }
      );
    }

    return NextResponse.json({
      success: true,
      data: result.data,
      message: `Member role updated to ${role}`,
    });
  } catch (error) {
    console.error('[team-api] Error in POST /api/workspace/member/role:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
