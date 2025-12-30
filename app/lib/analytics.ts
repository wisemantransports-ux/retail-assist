// Minimal analytics helper for click-tracking
// - Sends lightweight events to the server endpoint at /api/track-event
// - Also buffers events on `window._ra_events` for quick debugging during dev
// Keep this intentionally small so it can be replaced with a real analytics SDK later.

export type AnalyticsEvent = {
  event: string;
  props?: Record<string, any>;
  ts: number;
  url?: string;
};

export async function trackEvent(event: string, props: Record<string, any> = {}) {
  const payload: AnalyticsEvent = {
    event,
    props,
    ts: Date.now(),
    url: typeof window !== 'undefined' ? window.location.pathname : undefined,
  };

  // Buffer events on `window` for local inspection during development.
  if (typeof window !== 'undefined') {
    // @ts-ignore add a lightweight spot for local debugging
    window._ra_events = window._ra_events || [];
    // @ts-ignore
    window._ra_events.push(payload);
  }

  // Fire-and-forget POST to server endpoint. Don't block navigation.
  try {
    await fetch('/api/track-event', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
  } catch (err) {
    // Swallow errors — tracking should never break UX.
    // eslint-disable-next-line no-console
    console.warn('trackEvent failed', err);
  }
}

// Small convenience wrapper for pricing CTA clicks
export function trackPricingCTA(planId: string, planName: string, channel: string) {
  void trackEvent('pricing_cta_click', { planId, planName, channel });
}
