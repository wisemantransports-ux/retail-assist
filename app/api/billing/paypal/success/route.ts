import { NextRequest, NextResponse } from "next/server";
import { replitDb } from "@/lib/replit-db";

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

  try {
    const { searchParams } = new URL(request.url);
    const subscriptionId = searchParams.get("subscription_id");

    if (!subscriptionId) {
      console.error("Missing subscription_id in callback");
      return NextResponse.redirect(`${baseUrl}/checkout?error=missing_subscription_id`);
    }

    const accessToken = await getPayPalAccessToken();
    const subscription = await getSubscriptionDetails(subscriptionId, accessToken);

    console.log("PayPal subscription response:", JSON.stringify(subscription, null, 2));

    if (subscription.status !== "ACTIVE" && subscription.status !== "APPROVED") {
      console.error("Subscription not active:", subscription.status);
      return NextResponse.redirect(`${baseUrl}/checkout?error=subscription_${subscription.status.toLowerCase()}`);
    }

    const customId = subscription.custom_id;
    if (!customId || !customId.includes(":")) {
      console.error("Invalid or missing custom_id:", customId);
      return NextResponse.redirect(`${baseUrl}/checkout?error=invalid_callback`);
    }

    const [userId] = customId.split(":");
    
    const paypalPlanId = subscription.plan_id;
    const planType = PAYPAL_PLAN_TO_TYPE[paypalPlanId];
    
    if (!planType) {
      console.error("Unknown PayPal plan_id:", paypalPlanId);
      return NextResponse.redirect(`${baseUrl}/checkout?error=unknown_plan`);
    }

    const user = await replitDb.users.findById(userId);
    
    if (!user) {
      console.error("User not found:", userId);
      return NextResponse.redirect(`${baseUrl}/checkout?error=user_not_found`);
    }

    const now = new Date().toISOString();
    const billingEnd = new Date();
    billingEnd.setMonth(billingEnd.getMonth() + 1);

    await replitDb.users.update(userId, {
      payment_status: "paid",
      subscription_status: "pending",
      paypal_subscription_id: subscriptionId,
      plan_type: planType,
      billing_start_date: now,
      billing_end_date: billingEnd.toISOString()
    });

    console.log("User updated successfully:", userId, "Plan:", planType, "Status: pending (awaiting admin activation)");

    return NextResponse.redirect(`${baseUrl}/dashboard/billing/payment-required?success=true`);

  } catch (error) {
    console.error("Subscription success error:", error);
    return NextResponse.redirect(`${baseUrl}/checkout?error=verification_failed`);
  }
}
