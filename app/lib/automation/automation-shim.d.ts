// @ts-nocheck
// Minimal type declarations (shim) used only by the automation executor
// This file keeps type fixes local to the automation module and avoids
// touching other parts of the repository.

declare module '@/lib/supabase/server' {
  import type { SupabaseClient } from '@supabase/supabase-js';
  export function createServerSupabaseClient(): SupabaseClient;
  export function createAdminSupabaseClient(): SupabaseClient;
  export function createServerClient(): SupabaseClient;
  export function createMockAdminSupabaseClient(): Promise<any>;
  export default createServerClient;
}

declare module '@/lib/openai/server' {
  export function generateAgentResponse(systemPrompt: string, userMessage: string, opts?: any): Promise<string>;
  export function callOpenAIChat(messages: Array<any>, model?: string, options?: any): Promise<string>;
  export function estimateTokens(text: string): number;
  export function calculateOpenAICost(inputTokens: number, outputTokens: number, model?: string): number;
}

declare module '@/lib/env' {
  export const env: any & {
    useMockMode?: boolean;
    AUTOMATION_WEBHOOK_SECRET?: string;
    openai?: { apiKey?: string };
    isTestMode?: boolean;
  };
}
