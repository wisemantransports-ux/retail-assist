'use client';

import React, { createContext, useContext } from 'react';
import { useAuth, type AuthState } from '@/hooks/useAuth';

/**
 * Auth Context
 *
 * Provides the current auth state to all child components
 * without requiring multiple useAuth() calls
 *
 * USAGE:
 * ```tsx
 * <AuthProvider>
 *   <YourComponent />
 * </AuthProvider>
 *
 * // In child component:
 * const auth = useAuthContext();
 * ```
 */
const AuthContext = createContext<AuthState | undefined>(undefined);

export interface AuthProviderProps {
  children: React.ReactNode;
}

/**
 * AuthProvider Component
 *
 * Wraps the application and provides auth context to all children.
 * Place this at the top level (in root layout) to ensure all pages
 * and components have access to auth state.
 *
 * IMPORTANT: This uses the useAuth hook which must be called in a client component.
 * Never use in server components.
 */
export function AuthProvider({ children }: AuthProviderProps) {
  const authState = useAuth();

  return (
    <AuthContext.Provider value={authState}>
      {children}
    </AuthContext.Provider>
  );
}

/**
 * Hook to access auth context
 *
 * THROWS if used outside AuthProvider
 *
 * USAGE:
 * ```tsx
 * const auth = useAuthContext();
 * ```
 */
export function useAuthContext(): AuthState {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuthContext must be used within AuthProvider');
  }
  return context;
}
