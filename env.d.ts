declare namespace NodeJS {
  interface ProcessEnv {
    // Public env vars (visible in browser)
    NEXT_PUBLIC_SUPABASE_URL?: string;
    NEXT_PUBLIC_SUPABASE_ANON_KEY?: string;
    NEXT_PUBLIC_USE_MOCK_SUPABASE?: string;
    NEXT_PUBLIC_TEST_MODE?: string;

    // Server-only env vars (never exposed to browser)
    OPENAI_API_KEY?: string;
    META_PAGE_ACCESS_TOKEN?: string;
    META_VERIFY_TOKEN?: string;
    SUPABASE_SERVICE_ROLE_KEY?: string;

    // Node env
    NODE_ENV?: 'development' | 'production' | 'test';
  }
}
