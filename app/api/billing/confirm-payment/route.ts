import { NextResponse } from "next/server";
import { replitDb } from "@/lib/replit-db";
import { sessionManager } from "@/lib/replit-db/session";

export async function POST(request: Request) {
  try {
    const sessionId = request.headers
      .get("cookie")
      ?.split(";")
      .find((c) => c.trim().startsWith("session_id="))
      ?.split("=")[1];

    if (!sessionId) {
      return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
    }

    const session = sessionManager.validate(sessionId);
    if (!session) {
      return NextResponse.json({ error: "Session expired" }, { status: 401 });
    }

    const user = await replitDb.users.findById(session.user_id);
    if (!user) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    if (user.subscription_status === "active") {
      return NextResponse.json({ error: "Account already active" }, { status: 400 });
    }

    if (user.payment_status === "paid" && user.subscription_status === "awaiting_approval") {
      return NextResponse.json({ error: "Payment already confirmed" }, { status: 400 });
    }

    await replitDb.users.update(user.id, {
      payment_status: "paid",
      subscription_status: "awaiting_approval"
    });

    await replitDb.logs.add({
      user_id: user.id,
      level: "info",
      message: `Payment confirmed by user. Plan: ${user.plan_type}. Awaiting admin approval.`,
      meta: { plan_type: user.plan_type }
    });

    return NextResponse.json({
      success: true,
      message: "Payment confirmed. Awaiting admin approval."
    });
  } catch (error: any) {
    console.error("[Billing] Error confirming payment:", error.message);
    return NextResponse.json({ error: "Failed to confirm payment" }, { status: 500 });
  }
}
