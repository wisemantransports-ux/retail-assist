/**
 * Type Shim for Webhook Handlers
 * Provides minimal type declarations to support webhook module imports
 * without requiring full repo-wide type checking.
 */

declare global {
  // Executor function types
  interface AutomationInput {
    workspaceId: string;
    agentId: string;
    commentId: string;
    commentText: string;
    authorId: string;
    authorName: string;
    platform: string;
    messageType: string;
    metadata?: Record<string, any>;
  }

  interface AutomationResult {
    ok: boolean;
    ruleMatched?: boolean;
    actionExecuted?: boolean;
    error?: string;
  }

  function executeAutomationRulesForMessage(input: AutomationInput): Promise<AutomationResult>;
  function executeAutomationRulesForComment(input: AutomationInput): Promise<AutomationResult>;

  // Environment
  interface GlobalEnv {
    useMockMode?: boolean;
    WEBHOOK_LOG_TABLE?: string;
    SUPABASE_URL?: string;
    SUPABASE_KEY?: string;
    FACEBOOK_WEBHOOK_SECRET?: string;
    INSTAGRAM_WEBHOOK_SECRET?: string;
    WHATSAPP_AUTH_TOKEN?: string;
    FORM_WEBHOOK_SECRET?: string;
  }

  var env: GlobalEnv | undefined;

  // Supabase client
    function createServerClient(): any;
}

export {};
