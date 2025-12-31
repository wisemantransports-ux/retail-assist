import { NextResponse } from 'next/server';
import { sessionManager } from '@/lib/session';

export async function POST(request: Request) {
  try {
    const sessionId = request.headers.get('cookie')?.split(';')
      .find(c => c.trim().startsWith('session_id='))
      ?.split('=')[1];
    
    if (sessionId) {
      sessionManager.destroy(sessionId);
    }
    
    const response = NextResponse.json({ success: true });
    // Ensure we delete the cookie with the same path used when setting it
    response.cookies.delete('session_id', { path: '/' });
    
    return response;
  } catch (error: any) {
    console.error('[Auth Logout] Error:', error.message);
    return NextResponse.json(
      { error: 'Logout failed' },
      { status: 500 }
    );
  }
}
