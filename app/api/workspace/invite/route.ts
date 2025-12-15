import { createServerClient } from '@/lib/supabase/server';
import { inviteMember } from '@/lib/supabase/queries';
import { NextRequest, NextResponse } from 'next/server';

/**
 * POST /api/workspace/invite
 * Invite a member to a workspace
 * 
 * Body:
 * {
 *   "workspace_id": "uuid",
 *   "email": "user@example.com",
 *   "role": "staff" | "admin"
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

    const { workspace_id, email, role } = await request.json();

    // Validation
    if (!workspace_id || !email || !role) {
      return NextResponse.json(
        { error: 'Missing required fields: workspace_id, email, role' },
        { status: 400 }
      );
    }

    if (!['staff', 'admin', 'owner'].includes(role)) {
      return NextResponse.json(
        { error: 'Invalid role. Must be staff, admin, or owner' },
        { status: 400 }
      );
    }

    // Validate email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return NextResponse.json(
        { error: 'Invalid email address' },
        { status: 400 }
      );
    }

    console.log(`[team-api] Inviting ${email} to workspace ${workspace_id} as ${role}`);

    // Invite member
    const result = await inviteMember(workspace_id, email, role as any, user.id);

    if (result.error) {
      console.error('[team-api] Error inviting member:', result.error);
      return NextResponse.json(
        { error: result.error },
        { status: 400 }
      );
    }

    // TODO: Send invite email
    console.log('[team-api] Invite created, would send email to:', email);

    return NextResponse.json({
      success: true,
      data: result.data,
      message: `Invite sent to ${email}`,
    });
  } catch (error) {
    console.error('[team-api] Error in POST /api/workspace/invite:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
