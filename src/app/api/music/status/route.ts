import { NextResponse } from "next/server";
import { isSpotifyConnected } from "@/lib/spotifySession";

export async function GET() {
  const connected = await isSpotifyConnected();
  return NextResponse.json({ connected });
}
