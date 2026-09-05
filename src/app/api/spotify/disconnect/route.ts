import { NextResponse } from "next/server";
import { clearSpotifySessionCookie } from "@/lib/spotifySession";

export async function POST() {
  await clearSpotifySessionCookie();
  return NextResponse.json({ ok: true });
}
