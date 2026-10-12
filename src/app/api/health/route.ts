import { NextResponse } from "next/server";
import { db } from "@/lib/db";

/** GET /api/health -> 200 when the database answers, 503 otherwise (Docker healthcheck) */
export async function GET() {
  try {
    const database = await db();
    await database.get("SELECT 1 AS ok");
    return NextResponse.json({ ok: true, database: database.kind });
  } catch (err) {
    // The reason goes to the server log only: driver errors can name hosts and users
    console.error("Health check failed:", err);
    return NextResponse.json({ ok: false }, { status: 503 });
  }
}
