import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { sessionManager } from "@/lib/replit-db/session";
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
  try {
    const cookieStore = await cookies();
    const sessionId = cookieStore.get("session_id")?.value;
    const session = sessionManager.validate(sessionId || "");

    if (!session?.user_id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();
    const { plan } = body;

    if (!plan || !PLAN_IDS[plan]) {
      return NextResponse.json({ error: "Invalid plan. Use: starter, pro, or enterprise" }, { status: 400 });
    }

    const paypalPlanId = PLAN_IDS[plan];
    const accessToken = await getPayPalAccessToken();

    const baseUrl = request.nextUrl.origin;

    const brandConfig = getBrand();
    const subscriptionPayload = {
      plan_id: paypalPlanId,
      custom_id: `${session.user_id}:${plan}`,
      application_context: {
        brand_name: brandConfig.name,
        locale: "en-US",
        shipping_preference: "NO_SHIPPING",
        user_action: "SUBSCRIBE_NOW",
        return_url: `${baseUrl}/api/billing/paypal/success`,
        cancel_url: `${baseUrl}/checkout?plan=${plan}&cancelled=true`
      }
    };

    const response = await fetch(`${PAYPAL_API_BASE}/v1/billing/subscriptions`, {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${accessToken}`,
        "Content-Type": "application/json",
        "Accept": "application/json",
        "Prefer": "return=representation"
      },
      body: JSON.stringify(subscriptionPayload)
    });

    if (!response.ok) {
      const errorData = await response.json();
      console.error("PayPal subscription error:", errorData);
      return NextResponse.json(
        { error: "Failed to create subscription", details: errorData },
        { status: 500 }
      );
    }

    const subscription = await response.json();

    const approvalLink = subscription.links?.find(
      (link: { rel: string; href: string }) => link.rel === "approve"
    );

    if (!approvalLink) {
      return NextResponse.json(
        { error: "No approval URL returned from PayPal" },
        { status: 500 }
      );
    }

    return NextResponse.json({
      subscription_id: subscription.id,
      approval_url: approvalLink.href,
      plan: plan,
      price: PLAN_PRICES[plan],
      status: subscription.status
    });

  } catch (error) {
    console.error("Create subscription error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Internal server error" },
      { status: 500 }
    );
  }
}
