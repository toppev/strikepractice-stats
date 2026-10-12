import { NextResponse } from "next/server";
import { searchPlayers } from "@/lib/queries/players";
import { headUrl } from "@/lib/images";

/** GET /api/search?q=ste -> players with "ste" in their name, "Ste…" first (for the search box) */
export async function GET(request: Request) {
  const q = new URL(request.url).searchParams.get("q") ?? "";
  const players = await searchPlayers(q);
  return NextResponse.json({ players: players.map((p) => ({ ...p, head: headUrl(p, 44) })) });
}
