import * as fs from 'fs';
import * as path from 'path';

const DATA_DIR = process.env.DATA_DIR || './.data';

interface User {
  id: string;
  email: string;
  password_hash: string;
  business_name: string;
  phone: string;
  plan_type: 'starter' | 'pro' | 'enterprise';
  payment_status: 'unpaid' | 'paid';
  subscription_status: 'pending' | 'awaiting_approval' | 'active' | 'suspended';
  billing_start_date?: string;
  billing_end_date?: string;
  paypal_subscription_id?: string;
  activated_at?: string;
  role: 'user' | 'admin';
  created_at: string;
  updated_at: string;
}

interface Token {
  id: string;
  user_id: string;
  platform: 'facebook' | 'instagram';
  page_id: string;
  page_name: string;
  access_token: string;
  created_at: string;
  updated_at: string;
}

interface BusinessSettings {
  id: string;
  user_id: string;
  auto_reply_enabled: boolean;
  comment_to_dm_enabled: boolean;
  greeting_message: string;
  away_message: string;
  keywords: string[];
  ai_enabled: boolean;
  system_prompt: string;
  created_at: string;
  updated_at: string;
}

interface LogEntry {
  id: string;
  user_id?: string;
  level: 'info' | 'warn' | 'error';
  message: string;
  meta?: Record<string, any>;
  created_at: string;
}

interface Database {
  users: Record<string, User>;
  tokens: Record<string, Token>;
  business_settings: Record<string, BusinessSettings>;
  logs: LogEntry[];
}

export const PLAN_LIMITS = {
  starter: {
    name: 'Starter',
    price: 22,
    maxPages: 1,
    hasInstagram: false,
    hasAiResponses: true,
    commentToDmLimit: 100,
    features: ['Facebook Messenger auto-reply', 'Comment-to-DM (100/month)', '1 Facebook Page', 'Basic AI responses']
  },
  pro: {
    name: 'Pro',
    price: 45,
    maxPages: 3,
    hasInstagram: true,
    hasAiResponses: true,
    commentToDmLimit: 500,
    features: ['Facebook + Instagram automation', 'Comment-to-DM (500/month)', '3 Pages/Accounts', 'AI-powered responses']
  },
  enterprise: {
    name: 'Enterprise',
    price: 75,
    maxPages: -1,
    hasInstagram: true,
    hasAiResponses: true,
    commentToDmLimit: -1,
    features: ['All features unlocked', 'Unlimited pages/accounts', 'Priority support', 'Custom automation rules']
  }
};

function ensureDataDir(): void {
  if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
  }
}

function getDbPath(): string {
  return path.join(DATA_DIR, 'database.json');
}

function readDb(): Database {
  ensureDataDir();
  const dbPath = getDbPath();
  
  if (!fs.existsSync(dbPath)) {
    const defaultDb: Database = {
      users: {},
      tokens: {},
      business_settings: {},
      logs: []
    };
    fs.writeFileSync(dbPath, JSON.stringify(defaultDb, null, 2));
    return defaultDb;
  }
  
  try {
    const data = fs.readFileSync(dbPath, 'utf-8');
    return JSON.parse(data);
  } catch (error) {
    console.error('[Database] Error reading database:', error);
    return { users: {}, tokens: {}, business_settings: {}, logs: [] };
  }
}

function writeDb(db: Database): void {
  ensureDataDir();
  const dbPath = getDbPath();
  fs.writeFileSync(dbPath, JSON.stringify(db, null, 2));
}

function generateId(): string {
  return crypto.randomUUID();
}

function generateSalt(): string {
  const array = new Uint8Array(16);
  crypto.getRandomValues(array);
  return Array.from(array).map(b => b.toString(16).padStart(2, '0')).join('');
}

async function hashPasswordWithSalt(password: string, salt: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(password + salt);
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  const hash = hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
  return `${salt}:${hash}`;
}

async function verifyPassword(password: string, storedHash: string): Promise<boolean> {
  if (storedHash.includes(':')) {
    const [salt, hash] = storedHash.split(':');
    const newHash = await hashPasswordWithSalt(password, salt);
    return newHash === storedHash;
  }
  const encoder = new TextEncoder();
  const data = encoder.encode(password + (process.env.PASSWORD_SALT || 'default_salt'));
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  const legacyHash = hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
  return legacyHash === storedHash;
}

function migrateUser(user: any): User {
  if (user.package && !user.plan_type) {
    const packageToPlan: Record<string, 'starter' | 'pro' | 'enterprise'> = {
      'starter': 'starter',
      'professional': 'pro',
      'enterprise': 'enterprise'
    };
    user.plan_type = packageToPlan[user.package] || 'starter';
  }
  if (user.status && !user.subscription_status) {
    const statusMap: Record<string, 'pending' | 'awaiting_approval' | 'active' | 'suspended'> = {
      'pending': 'pending',
      'active': 'active',
      'inactive': 'suspended'
    };
    user.subscription_status = statusMap[user.status] || 'pending';
  }
  if (!user.payment_status) {
    user.payment_status = user.subscription_status === 'active' ? 'paid' : 'unpaid';
  }
  delete user.package;
  delete user.status;
  return user as User;
}

export const replitDb = {
  users: {
    async create(data: {
      email: string;
      password: string;
      business_name: string;
      phone: string;
      plan_type: 'starter' | 'pro' | 'enterprise';
    }): Promise<User | null> {
      try {
        const db = readDb();
        
        const existing = Object.values(db.users).find(u => u.email === data.email);
        if (existing) {
          throw new Error('Email already exists');
        }
        
        const id = generateId();
        const now = new Date().toISOString();
        const salt = generateSalt();
        const password_hash = await hashPasswordWithSalt(data.password, salt);
        
        const user: User = {
          id,
          email: data.email,
          password_hash,
          business_name: data.business_name,
          phone: data.phone,
          plan_type: data.plan_type,
          payment_status: 'unpaid',
          subscription_status: 'pending',
          role: 'user',
          created_at: now,
          updated_at: now
        };
        
        db.users[id] = user;
        writeDb(db);
        
        const defaultSettings: BusinessSettings = {
          id: generateId(),
          user_id: id,
          auto_reply_enabled: true,
          comment_to_dm_enabled: true,
          greeting_message: `Hi! Thanks for reaching out to ${data.business_name}! How can we help you today?`,
          away_message: `Thanks for your message! Our team at ${data.business_name} will get back to you shortly. In the meantime, feel free to browse our products/services.`,
          keywords: ['price', 'cost', 'buy', 'order', 'available', 'stock', 'deliver', 'shipping', 'payment', 'discount'],
          ai_enabled: true,
          system_prompt: `You are a friendly, professional sales assistant for ${data.business_name}. Your goal is to help customers and close sales 24/7.

CORE OBJECTIVES:
1. Respond quickly and warmly to all inquiries
2. Answer product/service questions clearly
3. Guide customers toward making a purchase
4. Capture leads by asking for contact details when appropriate
5. Handle objections professionally

RESPONSE GUIDELINES:
- Keep responses concise (2-3 sentences max)
- Be friendly but professional
- Always offer to help further
- If asked about prices, provide info and ask if they'd like to order
- If customer shows interest, ask "Would you like me to help you place an order?"
- For complaints, apologize sincerely and offer solutions
- Never be pushy, but gently guide toward the sale

SAMPLE RESPONSES:
- Inquiry: "Yes, we have that in stock! Would you like me to reserve one for you?"
- Price question: "Great choice! That's [price]. Shall I help you with your order?"
- Availability: "Available now! Want me to arrange delivery for you?"

Always represent ${data.business_name} professionally and aim to convert inquiries into sales.`,
          created_at: now,
          updated_at: now
        };
        db.business_settings[defaultSettings.id] = defaultSettings;
        writeDb(db);
        
        return user;
      } catch (error: any) {
        console.error('[Database] Error creating user:', error.message);
        throw error;
      }
    },
    
    async findByEmail(email: string): Promise<User | null> {
      const db = readDb();
      const user = Object.values(db.users).find(u => u.email === email);
      return user ? migrateUser(user) : null;
    },
    
    async findById(id: string): Promise<User | null> {
      const db = readDb();
      const user = db.users[id];
      return user ? migrateUser(user) : null;
    },
    
    async authenticate(email: string, password: string): Promise<User | null> {
      const user = await this.findByEmail(email);
      if (!user) return null;
      
      const valid = await verifyPassword(password, user.password_hash);
      return valid ? user : null;
    },
    
    async getAll(): Promise<User[]> {
      const db = readDb();
      return Object.values(db.users).map(u => migrateUser(u));
    },
    
    async update(id: string, data: Partial<Omit<User, 'id' | 'created_at'>>): Promise<User | null> {
      const db = readDb();
      let user = db.users[id];
      if (!user) return null;
      
      user = migrateUser(user);
      
      db.users[id] = {
        ...user,
        ...data,
        updated_at: new Date().toISOString()
      };
      writeDb(db);
      return db.users[id];
    },
    
    async setSubscriptionStatus(id: string, status: 'pending' | 'active' | 'suspended'): Promise<User | null> {
      const updates: Partial<User> = { subscription_status: status };
      if (status === 'active') {
        const now = new Date();
        updates.billing_start_date = now.toISOString();
        const endDate = new Date(now);
        endDate.setMonth(endDate.getMonth() + 1);
        updates.billing_end_date = endDate.toISOString();
      }
      return this.update(id, updates);
    },
    
    async delete(id: string): Promise<boolean> {
      const db = readDb();
      if (!db.users[id]) return false;
      delete db.users[id];
      writeDb(db);
      return true;
    },

    getPlanLimits(planType: 'starter' | 'pro' | 'enterprise') {
      return PLAN_LIMITS[planType];
    },

    async canAddPage(userId: string): Promise<{ allowed: boolean; reason?: string }> {
      const user = await this.findById(userId);
      if (!user) return { allowed: false, reason: 'User not found' };
      
      const limits = PLAN_LIMITS[user.plan_type];
      if (limits.maxPages === -1) return { allowed: true };
      
      const db = readDb();
      const pageCount = Object.values(db.tokens).filter(t => t.user_id === userId).length;
      
      if (pageCount >= limits.maxPages) {
        return { 
          allowed: false, 
          reason: `Your ${limits.name} plan allows only ${limits.maxPages} page(s). Upgrade to add more.` 
        };
      }
      return { allowed: true };
    },

    async canUseInstagram(userId: string): Promise<boolean> {
      const user = await this.findById(userId);
      if (!user) return false;
      return PLAN_LIMITS[user.plan_type].hasInstagram;
    }
  },
  
  tokens: {
    async create(data: {
      user_id: string;
      platform: 'facebook' | 'instagram';
      page_id: string;
      page_name: string;
      access_token: string;
    }): Promise<Token> {
      const db = readDb();
      const id = generateId();
      const now = new Date().toISOString();
      
      const token: Token = {
        id,
        ...data,
        created_at: now,
        updated_at: now
      };
      
      db.tokens[id] = token;
      writeDb(db);
      return token;
    },
    
    async findByUserId(userId: string): Promise<Token[]> {
      const db = readDb();
      return Object.values(db.tokens).filter(t => t.user_id === userId);
    },
    
    async findByPageId(pageId: string): Promise<Token | null> {
      const db = readDb();
      return Object.values(db.tokens).find(t => t.page_id === pageId) || null;
    },
    
    async update(id: string, data: Partial<Omit<Token, 'id' | 'created_at'>>): Promise<Token | null> {
      const db = readDb();
      const token = db.tokens[id];
      if (!token) return null;
      
      db.tokens[id] = {
        ...token,
        ...data,
        updated_at: new Date().toISOString()
      };
      writeDb(db);
      return db.tokens[id];
    },
    
    async delete(id: string): Promise<boolean> {
      const db = readDb();
      if (!db.tokens[id]) return false;
      delete db.tokens[id];
      writeDb(db);
      return true;
    },

    async countByUserId(userId: string): Promise<number> {
      const db = readDb();
      return Object.values(db.tokens).filter(t => t.user_id === userId).length;
    }
  },
  
  settings: {
    async findByUserId(userId: string): Promise<BusinessSettings | null> {
      const db = readDb();
      return Object.values(db.business_settings).find(s => s.user_id === userId) || null;
    },
    
    async update(userId: string, data: Partial<Omit<BusinessSettings, 'id' | 'user_id' | 'created_at'>>): Promise<BusinessSettings | null> {
      const db = readDb();
      const settings = Object.values(db.business_settings).find(s => s.user_id === userId);
      if (!settings) return null;
      
      db.business_settings[settings.id] = {
        ...settings,
        ...data,
        updated_at: new Date().toISOString()
      };
      writeDb(db);
      return db.business_settings[settings.id];
    }
  },
  
  logs: {
    async add(data: {
      user_id?: string;
      level: 'info' | 'warn' | 'error';
      message: string;
      meta?: Record<string, any>;
    }): Promise<LogEntry> {
      const db = readDb();
      const entry: LogEntry = {
        id: generateId(),
        ...data,
        created_at: new Date().toISOString()
      };
      
      db.logs.push(entry);
      if (db.logs.length > 1000) {
        db.logs = db.logs.slice(-500);
      }
      writeDb(db);
      return entry;
    },
    
    async getRecent(limit: number = 100): Promise<LogEntry[]> {
      const db = readDb();
      return db.logs.slice(-limit).reverse();
    },
    
    async getByUserId(userId: string, limit: number = 50): Promise<LogEntry[]> {
      const db = readDb();
      return db.logs
        .filter(l => l.user_id === userId)
        .slice(-limit)
        .reverse();
    }
  }
};

export type { User, Token, BusinessSettings, LogEntry };
