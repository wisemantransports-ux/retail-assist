/**
 * Fetch user role from /api/auth/me with authoritative retry logic
 *
 * AUTHORITATIVE FLOW:
 * 1. Call GET /api/auth/me until status === 200
 * 2. Retry up to 3 times with 200ms delay between attempts
 * 3. If all 3 attempts fail with 401 → user auth failed
 * 4. If any attempt succeeds → return role and workspaceId
 *
 * NEVER call signOut during this flow - let retries handle transient failures
 */
export async function fetchUserRoleWithRetry() {
  let lastError: Error | null = null;
  let lastResponse: Response | null = null;

  for (let attempt = 1; attempt <= 3; attempt++) {
    try {
      console.log(`[fetchUserRole] Attempt ${attempt} of 3...`);

      const meResponse = await fetch('/api/auth/me', {
        method: 'GET',
        credentials: 'include', // CRITICAL: Send auth cookies with request
      });

      lastResponse = meResponse;

      // Success: user has role
      if (meResponse.ok) {
        const meData = await meResponse.json();
        console.log('[fetchUserRole] ✓ Success on attempt', attempt);
        console.log('[fetchUserRole] Response:', {
          role: meData.role,
          workspaceId: meData.workspaceId,
        });
        return {
          success: true,
          role: meData.role,
          workspaceId: meData.workspaceId,
          attempt,
        };
      }

      // 401/403: Auth failed, but retry in case it's transient
      if (meResponse.status === 401 || meResponse.status === 403) {
        console.warn(
          `[fetchUserRole] Attempt ${attempt} returned ${meResponse.status} - retrying...`
        );
        lastError = new Error(
          `Auth failed: ${meResponse.status} (${meResponse.statusText})`
        );

        // Don't immediately fail - retry
        if (attempt < 3) {
          await new Promise((resolve) => setTimeout(resolve, 200));
          continue;
        }

        // After 3 attempts, return failure
        return {
          success: false,
          role: null,
          workspaceId: null,
          attempt,
          error: `Authentication failed after 3 attempts (${meResponse.status})`,
        };
      }

      // Server error: don't retry, fail immediately
      if (meResponse.status >= 500) {
        const errorText = await meResponse.text();
        console.error('[fetchUserRole] Server error:', meResponse.status, errorText);
        return {
          success: false,
          role: null,
          workspaceId: null,
          attempt,
          error: `Server error (${meResponse.status})`,
        };
      }

      // Other error: retry
      console.warn(`[fetchUserRole] Unexpected status ${meResponse.status}, retrying...`);
      if (attempt < 3) {
        await new Promise((resolve) => setTimeout(resolve, 200));
        continue;
      }

      return {
        success: false,
        role: null,
        workspaceId: null,
        attempt,
        error: `Unexpected status ${meResponse.status}`,
      };
    } catch (err) {
      lastError = err as Error;
      console.error('[fetchUserRole] Network error on attempt', attempt, ':', lastError.message);

      if (attempt < 3) {
        await new Promise((resolve) => setTimeout(resolve, 200));
        continue;
      }

      return {
        success: false,
        role: null,
        workspaceId: null,
        attempt,
        error: `Network error: ${lastError.message}`,
      };
    }
  }

  // Should not reach here, but handle edge case
  return {
    success: false,
    role: null,
    workspaceId: null,
    attempt: 3,
    error: lastError?.message || 'Unknown error',
  };
}
