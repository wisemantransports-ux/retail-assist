/**
 * Centralized environment variable configuration
 * Ensures consistent access to env vars across the app
 * Supports both mock mode (local dev) and live mode (production)
 * 
 * CRITICAL: All properties use lazy getters to avoid reading env vars at module import time.
 * This prevents "SUPABASE_URL required" errors during next build on Vercel.
 */

// Helper: read a single env var (called at runtime, not import time)
function getEnvVar(key: string, defaultValue = ''): string {
  if (typeof process === 'undefined' || typeof process.env === 'undefined') {
    return defaultValue
  }
  return process.env[key] || defaultValue
}

// Create a lazy object that reads env vars on access, not on definition
export const env = {
  // Supabase (client-side + server-side) — lazy getters
  get supabase() {
    return {
      get url() { return getEnvVar('NEXT_PUBLIC_SUPABASE_URL') || getEnvVar('SUPABASE_URL') },
      get anonKey() { return getEnvVar('NEXT_PUBLIC_SUPABASE_ANON_KEY') || getEnvVar('SUPABASE_ANON_KEY') },
      get serviceRoleKey() { return getEnvVar('SUPABASE_SERVICE_ROLE_KEY') }, // Server-only, never expose to client
    }
  },

  // Mock mode flag — keep enabled by default until you explicitly go-live with Supabase.
  // Set NEXT_PUBLIC_USE_MOCK_SUPABASE = "false" in your environment to disable mock mode.
  get useMockMode() {
    const val = getEnvVar('NEXT_PUBLIC_USE_MOCK_SUPABASE')
    return (typeof val !== 'undefined' && val !== '') ? val === 'true' : true
  },

  // OpenAI (server-side only)
  get openai() {
    return {
      get apiKey() { return getEnvVar('OPENAI_API_KEY') },
    }
  },

  // Mock payments flag — enabled by default while in mock mode. Set NEXT_PUBLIC_USE_MOCK_PAYMENTS=false to enable live payments.
  get useMockPayments() {
    const val = getEnvVar('NEXT_PUBLIC_USE_MOCK_PAYMENTS')
    return (typeof val !== 'undefined' && val !== '') ? val === 'true' : true
  },

  // Meta/Facebook (server-side only)
  get meta() {
    return {
      get pageAccessToken() { return getEnvVar('META_PAGE_ACCESS_TOKEN') },
      get verifyToken() { return getEnvVar('META_VERIFY_TOKEN') },
      get appId() { return getEnvVar('META_APP_ID') },
      get appSecret() { return getEnvVar('META_APP_SECRET') },
    }
  },

  // Facebook Graph API
  get facebook() {
    return {
      get graphApiVersion() { return getEnvVar('FACEBOOK_GRAPH_API_VERSION', 'v19.0') },
    }
  },

  // WhatsApp Cloud API
  get whatsapp() {
    return {
      get apiToken() { return getEnvVar('WHATSAPP_API_TOKEN') },
      get businessAccountId() { return getEnvVar('WHATSAPP_BUSINESS_ACCOUNT_ID') },
      get phoneNumberId() { return getEnvVar('WHATSAPP_PHONE_NUMBER_ID') },
    }
  },

  // Stripe (payment processing)
  get stripe() {
    return {
      get apiKey() { return getEnvVar('STRIPE_API_KEY') },
      get webhookSecret() { return getEnvVar('STRIPE_WEBHOOK_SECRET') },
    }
  },
  get stripeSecretKey() {
    return getEnvVar('STRIPE_SECRET_KEY') || getEnvVar('STRIPE_API_KEY')
  },
  get stripeWebhookSecret() {
    return getEnvVar('STRIPE_WEBHOOK_SECRET')
  },

  // PayPal
  get paypal() {
    return {
      get clientId() { return getEnvVar('PAYPAL_CLIENT_ID') },
      get clientSecret() { return getEnvVar('PAYPAL_CLIENT_SECRET') },
      get webhookId() { return getEnvVar('PAYPAL_WEBHOOK_ID') },
      get apiBase() { return getEnvVar('PAYPAL_API_BASE', 'https://api-m.sandbox.paypal.com') },
      get mode() { return getEnvVar('PAYPAL_MODE', 'sandbox') }, // sandbox or live
    }
  },

  // Mobile money support
  get mobileMoney() {
    return {
      get supportEmail() { return getEnvVar('MOBILE_MONEY_SUPPORT_EMAIL') },
    }
  },

  // Test/Debug mode
  get isTestMode() {
    return getEnvVar('NEXT_PUBLIC_TEST_MODE') === 'true'
  },

  // App environment
  get isDevelopment() {
    return getEnvVar('NODE_ENV') === 'development'
  },
  get isProduction() {
    return getEnvVar('NODE_ENV') === 'production'
  },

  // App URLs
  get appUrl() {
    return getEnvVar('NEXT_PUBLIC_APP_URL', 'http://localhost:5000')
  },
  get dashboardUrl() {
    return getEnvVar('NEXT_PUBLIC_DASHBOARD_URL', 'http://localhost:5000/dashboard')
  },
  
  // Alerts
  get alertEmail() {
    return getEnvVar('ALERT_EMAIL')
  },
  get whatsappWebhookUrl() {
    return getEnvVar('WHATSAPP_WEBHOOK_URL')
  },
  get slackWebhookUrl() {
    return getEnvVar('SLACK_WEBHOOK_URL')
  },
  get sentryDsn() {
    return getEnvVar('SENTRY_DSN')
  },
};

/**
 * Validate that required env vars are set
 * Call this in critical API routes
 */
export function validateEnv(required: string[]): boolean {
  return required.every((key) => {
    const val = getEnvVar(key)
    if (!val) {
      console.warn(`Missing required environment variable: ${key}`);
      return false;
    }
    return true;
  });
}

// Note: Production validation is now removed from top-level.
// If you need to validate Supabase config, do it in your API routes or middleware.
