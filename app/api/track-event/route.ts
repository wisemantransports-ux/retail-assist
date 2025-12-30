import { NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';

// Minimal server endpoint to accept analytics events.
// For now this logs to server console and appends to a local file in /tmp for light persistence.
// This is intentionally simple and can be swapped for real analytics later.

export async function POST(request: Request) {
  try {
    const data = await request.json();
    const ts = new Date().toISOString();

    // Log to server console for easy visibility during dev
    // eslint-disable-next-line no-console
    console.info('[analytics] received event:', ts, data);

    try {
      // Append to a file in /tmp so we have a small audit trail during local dev
      const filePath = path.join('/tmp', 'retail-assist-analytics.log');
      const line = JSON.stringify({ ts, event: data }) + '\n';
      fs.appendFileSync(filePath, line);
    } catch (err) {
      // Ignore file errors — not critical
      // eslint-disable-next-line no-console
      console.warn('analytics: failed to write to /tmp', err);
    }

    return NextResponse.json({ ok: true });
  } catch (err) {
    // eslint-disable-next-line no-console
    console.error('analytics endpoint error', err);
    return NextResponse.json({ ok: false, error: String(err) }, { status: 500 });
  }
}
