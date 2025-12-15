"use client";
import { useState } from 'react';

export default function BillingActions({ subscription }: { subscription: any }) {
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState('');

  async function handlePayPal(planId: string) {
    setLoading(true);
    setMessage('');
    try {
      const resp = await fetch('/api/billing/paypal/create', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ planId }),
      });
      const json = await resp.json();
      if (json.approvalUrl) {
        window.location.href = json.approvalUrl;
        return;
      }
      setMessage(json.error || 'No approval URL returned');
    } catch (err: any) {
      setMessage(err.message || 'Request failed');
    } finally {
      setLoading(false);
    }
  }

  async function handleMobileMoney(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setMessage('');
    const form = e.target as HTMLFormElement;
    const fd = new FormData(form);
    const phoneNumber = fd.get('phoneNumber') as string;
    const receiptUrl = fd.get('receiptUrl') as string;

    try {
      const resp = await fetch('/api/billing/mobile-money/submit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ phoneNumber, receiptUrl }),
      });
      const json = await resp.json();
      if (json.payment) {
        setMessage('Payment submitted for review');
      } else {
        setMessage(json.error || 'Failed to submit');
      }
    } catch (err: any) {
      setMessage(err.message || 'Request failed');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div>
      <div className="mb-4">
        <strong>Current plan:</strong> {subscription?.plan || 'Free'} — <strong>status:</strong> {subscription?.status || 'free'}
      </div>

      <div className="mb-6">
        <button className="btn" onClick={() => handlePayPal('paypal_plan_basic')} disabled={loading}>
          Pay with PayPal
        </button>
      </div>

      <form onSubmit={handleMobileMoney} className="mb-6">
        <div>
          <label>Phone number</label>
          <input name="phoneNumber" className="input" />
        </div>
        <div>
          <label>Receipt URL</label>
          <input name="receiptUrl" className="input" />
        </div>
        <button className="btn" type="submit" disabled={loading}>Submit Mobile Money Payment</button>
      </form>

      {message && <div className="mt-4">{message}</div>}
    </div>
  );
}
