// @ts-nocheck
// Minimal type declarations (shim) used only by the automation executor
// This file keeps type fixes local to the automation module and avoids
// touching other parts of the repository.

declare module '@/lib/supabase/server' {
  import type { SupabaseClient } from '@supabase/supabase-js';
  export function createServerSupabaseClient(): SupabaseClient;
  export function createAdminSupabaseClient(): SupabaseClient;
  export default createServerSupabaseClient;
}

declare module '@/lib/supabase/queries' {
  export function createDirectMessage(workspaceId: string, payload: any): Promise<any>;
}

declare module '@/lib/openai/server' {
  export function generateAgentResponse(systemPrompt: string, userMessage: string, opts?: any): Promise<string>;
}

declare module '@/lib/env' {
  export const env: any & {
    useMockMode?: boolean;
    AUTOMATION_WEBHOOK_SECRET?: string;
    openai?: { apiKey?: string };
    isTestMode?: boolean;
  };
}
