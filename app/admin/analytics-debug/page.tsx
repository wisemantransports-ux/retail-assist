import fs from 'fs';
import path from 'path';
import React from 'react';

// INTERNAL DEBUG PAGE — READ-ONLY
// - Server-rendered page that reads the simple log at /tmp/retail-assist-analytics.log
// - Shows the most recent events (timestamp, event, planId, planName, channel, url)
// - NO authentication and NO editing/deleting. Intended for local / internal use only.

type LogLine = {
  ts?: string;
  event?: any;
};

function safeParse(line: string) {
  try {
    return JSON.parse(line);
  } catch (err) {
    return null;
  }
}

export default function AnalyticsDebugPage() {
  const filePath = path.join('/tmp', 'retail-assist-analytics.log');
  let lines: string[] = [];
  try {
    if (fs.existsSync(filePath)) {
      const raw = fs.readFileSync(filePath, 'utf8');
      lines = raw.split('\n').filter((l) => l.trim().length > 0);
    }
  } catch (err) {
    // If the file is unreadable, we will show an error message in the UI below.
    // eslint-disable-next-line no-console
    console.warn('analytics debug: failed to read log file', err);
  }

  // Parse lines into objects and keep latest first
  const events = lines
    .map((l) => safeParse(l))
    .filter(Boolean)
    .reverse()
    .slice(0, 200) // limit to latest 200 for performance
    .map((obj: LogLine) => {
      // The logging format is: { ts, event: { event, props, ts, url } }
      const outerTs = obj.ts;
      const payload = obj.event || {};
      const innerTs = payload.ts;
      const timestamp = outerTs || (innerTs ? new Date(innerTs).toISOString() : '—');
      const eventName = payload.event || payload.eventName || '—';
      const props = payload.props || {};

      return {
        timestamp,
        eventName,
        planId: props.planId ?? props.plan_id ?? '—',
        planName: props.planName ?? props.plan_name ?? '—',
        channel: props.channel ?? '—',
        url: payload.url ?? '—',
        raw: obj,
      };
    });

  return (
    <main className="py-12">
      <div className="container-max">
        <div className="max-w-6xl mx-auto">
          <div className="mb-6">
            <h1 className="text-2xl font-bold">Internal Debug — Analytics Events</h1>
            <p className="text-sm text-muted mt-1">Read-only page for local inspection. Do not expose publicly.</p>
            <p className="text-sm text-muted mt-2">Showing latest <strong>{events.length}</strong> events (most recent first).</p>
          </div>

          <div className="overflow-x-auto rounded-lg border border-card-border bg-card-bg">
            <table className="w-full text-left table-fixed">
              <thead>
                <tr className="text-sm text-muted">
                  <th className="px-4 py-3 w-48">Timestamp</th>
                  <th className="px-4 py-3 w-40">Event</th>
                  <th className="px-4 py-3 w-28">Plan ID</th>
                  <th className="px-4 py-3">Plan Name</th>
                  <th className="px-4 py-3 w-28">Channel</th>
                  <th className="px-4 py-3">Page URL</th>
                </tr>
              </thead>
              <tbody>
                {events.length === 0 ? (
                  <tr>
                    <td className="px-4 py-6 text-sm text-muted" colSpan={6}>
                      No events found. Trigger a pricing CTA to generate events.
                    </td>
                  </tr>
                ) : (
                  events.map((e, i) => (
                    <tr key={i} className="border-t border-card-border even:bg-card-bg/60">
                      <td className="px-4 py-3 text-sm align-top">{e.timestamp}</td>
                      <td className="px-4 py-3 text-sm align-top">{e.eventName}</td>
                      <td className="px-4 py-3 text-sm align-top">{e.planId}</td>
                      <td className="px-4 py-3 text-sm align-top">{e.planName}</td>
                      <td className="px-4 py-3 text-sm align-top">{e.channel}</td>
                      <td className="px-4 py-3 text-sm align-top">{e.url}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>

          <div className="mt-6 text-sm text-muted">
            <p>
              Note: This page is intentionally minimal and read-only. Events are stored as
              newline-delimited JSON in <code>/tmp/retail-assist-analytics.log</code> on the
              server. Implement secure storage and access controls before exposing this
              data in production.
            </p>
          </div>
        </div>
      </div>
    </main>
  );
}
