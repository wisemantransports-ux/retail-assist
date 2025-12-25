import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { sessionManager } from "@/lib/session";

export async function POST(request: Request) {
  try {
    const sessionId = request.headers
      .get("cookie")
      ?.split(";")
      .find((c) => c.trim().startsWith("session_id="))
      ?.split("=")[1];

    if (!sessionId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const session = await sessionManager.validate(sessionId);
    if (!session) {
      return NextResponse.json({ error: "Invalid session" }, { status: 401 });
    }

    const user = await db.users.findById(session.user_id);
    if (!user) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    const { plan_type } = await request.json();

    if (!["starter", "pro", "enterprise"].includes(plan_type)) {
      return NextResponse.json({ error: "Invalid plan type" }, { status: 400 });
    }

    await db.users.update(user.id, {
      plan_type,
      payment_status: "unpaid",
      subscription_status: "pending"
    });

    return NextResponse.json({ success: true, plan_type });
  } catch (error) {
    console.error("Update plan error:", error);
    return NextResponse.json({ error: "Failed to update plan" }, { status: 500 });
  }
}
