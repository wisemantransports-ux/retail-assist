import { createAdminSupabaseClient } from '@/lib/supabase/server';
import { NextRequest, NextResponse } from 'next/server';

/**
 * GET /api/employees/invite-preview
 * Preview an invite before accepting it
 * 
 * Query Parameters:
 * - token: UUID invite token
 * 
 * Response (Success):
 * {
 *   email: string,
 *   workspace_id: uuid,
 *   status: 'pending',
 *   expires_at: ISO timestamp
 * }
 * 
 * Response (Error):
 * {
 *   error: "Invalid or expired invite token"
 * }
 */
export async function GET(request: NextRequest) {
  try {
    // Extract token from query parameter
    const { searchParams } = new URL(request.url);
    const token = searchParams.get('token');

    // Validate token
    if (!token || typeof token !== 'string') {
      return NextResponse.json(
        { error: 'Invalid or expired invite token' },
        { status: 400 }
      );
    }

    // Lookup invite with admin client (bypasses RLS)
    const admin = createAdminSupabaseClient();

    const { data: invite, error: inviteError } = await admin
      .from('employee_invites')
      .select('email, workspace_id, status, expires_at')
      .eq('token', token)
      .single();

    // Reject if not found or not pending
    if (inviteError || !invite || invite.status !== 'pending') {
      return NextResponse.json(
        { error: 'Invalid or expired invite token' },
        { status: 400 }
      );
    }

    // Return preview data
    return NextResponse.json({
      email: invite.email,
      workspace_id: invite.workspace_id,
      status: invite.status,
      expires_at: invite.expires_at,
    });
  } catch (error) {
    console.error('[GET /api/employees/invite-preview] Unexpected error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
