import { createServerClient } from '@/lib/supabase/server';
import { acceptInvite } from '@/lib/supabase/queries';
import { NextRequest, NextResponse } from 'next/server';

/**
 * POST /api/workspace/invite/accept
 * Accept a workspace invite
 * 
 * Body:
 * {
 *   "token": "invite-token-uuid"
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

    const { token } = await request.json();

    // Validation
    if (!token) {
      return NextResponse.json(
        { error: 'Missing required field: token' },
        { status: 400 }
      );
    }

    console.log(`[team-api] Accepting invite with token: ${token.substring(0, 8)}...`);

    // Accept invite
    const result = await acceptInvite(token, user.id);

    if (result.error) {
      console.error('[team-api] Error accepting invite:', result.error);
      return NextResponse.json(
        { error: result.error },
        { status: 400 }
      );
    }

    // TODO: Send invite accepted email
    console.log('[team-api] Invite accepted by user:', user.id);

    return NextResponse.json({
      success: true,
      data: result.data,
      message: 'Invite accepted successfully',
    });
  } catch (error) {
    console.error('[team-api] Error in POST /api/workspace/invite/accept:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
