// DEPRECATED: Replit session storage removed. Use `@/lib/session` (Supabase) instead.

throw new Error('Replit-based session storage has been removed. Import from "@/lib/session" instead.');

function ensureDataDir(): void {
  if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
  }
}

function readSessions(): Record<string, Session> {
  ensureDataDir();
  if (!fs.existsSync(SESSIONS_FILE)) {
    fs.writeFileSync(SESSIONS_FILE, '{}');
    return {};
  }
  try {
    return JSON.parse(fs.readFileSync(SESSIONS_FILE, 'utf-8'));
  } catch {
    return {};
  }
}

function writeSessions(sessions: Record<string, Session>): void {
  ensureDataDir();
  fs.writeFileSync(SESSIONS_FILE, JSON.stringify(sessions, null, 2));
}

function generateSessionId(): string {
  return crypto.randomUUID() + '-' + crypto.randomUUID();
}

export const sessionManager = {
  create(userId: string, expiresInHours: number = 24 * 7): Session {
    const sessions = readSessions();
    const now = new Date();
    const expiresAt = new Date(now.getTime() + expiresInHours * 60 * 60 * 1000);
    
    const session: Session = {
      id: generateSessionId(),
      user_id: userId,
      created_at: now.toISOString(),
      expires_at: expiresAt.toISOString()
    };
    
    sessions[session.id] = session;
    writeSessions(sessions);
    return session;
  },
  
  validate(sessionId: string): Session | null {
    if (!sessionId) return null;
    
    const sessions = readSessions();
    const session = sessions[sessionId];
    
    if (!session) return null;
    
    const now = new Date();
    const expiresAt = new Date(session.expires_at);
    
    if (now > expiresAt) {
      delete sessions[sessionId];
      writeSessions(sessions);
      return null;
    }
    
    return session;
  },
  
  destroy(sessionId: string): void {
    const sessions = readSessions();
    delete sessions[sessionId];
    writeSessions(sessions);
  },
  
  destroyAllForUser(userId: string): void {
    const sessions = readSessions();
    const updated: Record<string, Session> = {};
    
    for (const [id, session] of Object.entries(sessions)) {
      if (session.user_id !== userId) {
        updated[id] = session;
      }
    }
    
    writeSessions(updated);
  },
  
  cleanup(): void {
    const sessions = readSessions();
    const now = new Date();
    const updated: Record<string, Session> = {};
    
    for (const [id, session] of Object.entries(sessions)) {
      if (new Date(session.expires_at) > now) {
        updated[id] = session;
      }
    }
    
    writeSessions(updated);
  }
};

export type { Session };
