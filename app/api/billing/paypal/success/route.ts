import { NextRequest, NextResponse } from "next/server";

const PAYPAL_API_BASE = "https://api-m.paypal.com";

const PAYPAL_PLAN_TO_TYPE: Record<string, "starter" | "pro" | "enterprise"> = {
  "P-5UR06154M6627520CNE64LUY": "starter",
  "P-1UV77920V62315442NE64TUQ": "pro",
  "P-1AS84342BJ038470VNE64XHI": "enterprise"
};

async function getPayPalAccessToken(): Promise<string> {
  const clientId = process.env.PAYPAL_CLIENT_ID;
  const clientSecret = process.env.PAYPAL_CLIENT_SECRET_KEY;

  if (!clientId || !clientSecret) {
    throw new Error("PayPal credentials not configured");
  }

  const auth = Buffer.from(`${clientId}:${clientSecret}`).toString("base64");

  const response = await fetch(`${PAYPAL_API_BASE}/v1/oauth2/token`, {
    method: "POST",
    headers: {
      "Authorization": `Basic ${auth}`,
      "Content-Type": "application/x-www-form-urlencoded"
    },
    body: "grant_type=client_credentials"
  });

  if (!response.ok) {
    throw new Error("Failed to get PayPal access token");
  }

  const data = await response.json();
  return data.access_token;
}

async function getSubscriptionDetails(subscriptionId: string, accessToken: string) {
  const response = await fetch(`${PAYPAL_API_BASE}/v1/billing/subscriptions/${subscriptionId}`, {
    method: "GET",
    headers: {
      "Authorization": `Bearer ${accessToken}`,
      "Content-Type": "application/json"
    }
  });

  if (!response.ok) {
    throw new Error("Failed to get subscription details");
  }

  return response.json();
}

export async function GET(request: NextRequest) {
  const baseUrl = request.nextUrl.origin;
  // PayPal integration is disabled per config. Redirect user to billing page and show notice.
  return NextResponse.redirect(`${baseUrl}/dashboard/billing?payment_disabled=true`);
}
