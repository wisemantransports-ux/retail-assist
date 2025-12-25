import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { sessionManager } from "@/lib/session";
import { getBrand } from "@/config/branding";

const PAYPAL_API_BASE = "https://api-m.paypal.com";

const PLAN_IDS: Record<string, string> = {
  starter: "P-5UR06154M6627520CNE64LUY",
  pro: "P-1UV77920V62315442NE64TUQ",
  enterprise: "P-1AS84342BJ038470VNE64XHI"
};

const PLAN_PRICES: Record<string, number> = {
  starter: 22,
  pro: 45,
  enterprise: 75
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
    const errorText = await response.text();
    console.error("PayPal token error:", errorText);
    throw new Error("Failed to get PayPal access token");
  }

  const data = await response.json();
  return data.access_token;
}

export async function POST(request: NextRequest) {
  return NextResponse.json({ error: 'Payment gateway disabled. Payments are currently disconnected.' }, { status: 503 });
}
