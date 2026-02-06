import { createAdminSupabaseClient } from '@/lib/supabase/server';
import { PLATFORM_WORKSPACE_ID } from '@/lib/config/workspace';
import { NextRequest, NextResponse } from 'next/server';
import crypto from 'crypto';

/**
 * POST /api/super-admin/employees/invite
 *
 * Send invite to a new platform employee
 *
 * Authorization:
 * - super_admin only
 *
 * Request body:
 * {
 *   email: string (required)
 *   first_name: string (optional)
 * }
 *
 * Behavior:
 * 1. Super admin submits invite form
 * 2. API creates employee_invites record with:
 *    - workspace_id = null (super_admin indicator)
 *    - token = random 32-byte token
 *    - status = 'pending'
 * 3. Client should send invite email to employee (handle separately)
 * 4. Employee clicks link → /invite?token=xxx
 * 5. Employee submits form → POST /api/employees/accept-invite?token=xxx
 * 6. Accept-invite creates user + employee with PLATFORM_WORKSPACE_ID
 * 7. Employee redirected to login
 *
 * Returns:
 * - success: true
 * - email: string
 * - token: string (for invite link)
 * - invite_id: string
 */
export async function POST(request: NextRequest) {
  try {
    // Parse request body
    let body: any;
    try {
      body = await request.json();
    } catch {
      return NextResponse.json(
        { success: false, error: 'Invalid request body' },
        { status: 400 }
      );
    }

    const { email, first_name } = body;

    // Validate email
    if (!email || typeof email !== 'string') {
      return NextResponse.json(
        { success: false, error: 'Email is required' },
        { status: 400 }
      );
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return NextResponse.json(
        { success: false, error: 'Invalid email format' },
        { status: 400 }
      );
    }

    // Create admin client
    const admin = createAdminSupabaseClient();

    // ===== AUTHORITATIVE ROLE RESOLUTION (RPC ONLY) =====
    // Get current user to check role using RPC (single source of truth)
    const cookieHeader = request.headers.get('cookie');
    const authHeader = request.headers.get('authorization');
    let currentUserId: string | null = null;

    if (authHeader?.startsWith('Bearer ')) {
      try {
        const token = authHeader.substring(7);
        const {
          data: { user },
        } = await admin.auth.getUser(token);
        currentUserId = user?.id || null;
      } catch (err) {
        //
      }
    }

    if (!currentUserId) {
      console.log('[SUPER_ADMIN_INVITE] No authenticated user found');
      return NextResponse.json(
        { success: false, error: 'Unauthorized' },
        { status: 401 }
      );
    }

    // Create auth server client for RPC call
    const { createServerClient } = await import('@supabase/ssr');
    const { cookies } = await import('next/headers');
    const cookieStore = await cookies();
    
    const supabaseForRpc = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        cookies: {
          getAll() {
            return cookieStore.getAll();
          },
          setAll(cookiesToSet) {
            cookiesToSet.forEach(({ name, value, options }) => {
              cookieStore.set(name, value, options);
            });
          },
        },
      }
    );

    // Use RPC for authoritative role resolution
    const result = await supabaseForRpc
      .rpc('rpc_get_user_access')
      .single();
    const roleData = result.data;

    if (!roleData) {
      console.log('[SUPER_ADMIN_INVITE] RPC role resolution failed or no data');
      return NextResponse.json(
        { success: false, error: 'Unauthorized' },
        { status: 403 }
      );
    }

    const { role, workspace_id } = roleData as { role: string; workspace_id: string | null };

    // Authorization check: only super_admin (must have workspace_id = null)
    if (role !== 'super_admin') {
      console.log('[SUPER_ADMIN_INVITE] Access denied for role:', role);
      return NextResponse.json(
        { success: false, error: 'Unauthorized' },
        { status: 403 }
      );
    }

    if (workspace_id !== null) {
      console.error('[SUPER_ADMIN_INVITE] Super admin has non-null workspace_id - invalid state');
      return NextResponse.json(
        { success: false, error: 'Unauthorized' },
        { status: 403 }
      );
    }

    console.log('[SUPER_ADMIN_INVITE] Creating invite for:', email);

    // Generate random token (32 bytes = 256 bits)
    const token = crypto.randomBytes(32).toString('hex');

    // Check if invite already exists for this email
    const { data: existingInvite } = await admin
      .from('employee_invites')
      .select('id')
      .eq('email', email)
      .eq('status', 'pending')
      .single();

    if (existingInvite) {
      console.log('[SUPER_ADMIN_INVITE] Pending invite already exists for:', email);
      return NextResponse.json(
        { success: false, error: 'Pending invite already exists for this email' },
        { status: 409 }
      );
    }

    // Create invite record
    // workspace_id = null indicates this is a super_admin invite
    const { data: invite, error: inviteError } = await admin
      .from('employee_invites')
      .insert({
        email: email.toLowerCase(),
        first_name: first_name || null,
        token,
        status: 'pending',
        workspace_id: null, // CRITICAL: null = super_admin invite
        expires_at: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(), // 30 days
      })
      .select('id')
      .single();

    if (inviteError) {
      console.error('[SUPER_ADMIN_INVITE] Failed to create invite:', inviteError);
      return NextResponse.json(
        { success: false, error: 'Failed to create invite' },
        { status: 500 }
      );
    }

    console.log('[SUPER_ADMIN_INVITE] Invite created:', {
      email,
      invite_id: invite?.id,
      token_preview: token.substring(0, 16) + '...',
    });

    // TODO: Send invite email to employee
    // For now, return token so UI can display or send manually

    return NextResponse.json(
      {
        success: true,
        email: email.toLowerCase(),
        token: token,
        invite_id: invite.id,
        message: 'Invite created. Send the invite link to the employee.',
      },
      { status: 201 }
    );
  } catch (error) {
    console.error('[SUPER_ADMIN_INVITE] Error:', error);
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    );
  }
}
