import { getUserSubscription } from '@/lib/supabase/queries';

/**
 * Helper to check whether a user has an active subscription
 */
export async function userHasActiveSubscription(userId: string) {
  const sub = await getUserSubscription(userId);
  if (!sub) return false;
  return sub.status === 'active';
}
