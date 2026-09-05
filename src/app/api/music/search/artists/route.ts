import { NextRequest, NextResponse } from "next/server";
import { withSpotifyAccessToken } from "@/lib/apiSpotifyHandler";
import { spotifyWebApiProvider } from "@/integrations/spotify/SpotifyWebApiProvider";

export async function GET(request: NextRequest) {
  const query = request.nextUrl.searchParams.get("q")?.trim();
  const offset = Number(request.nextUrl.searchParams.get("offset") ?? "0") || 0;
  if (!query) {
    return NextResponse.json({ items: [], offset: 0, limit: 0, total: 0, hasMore: false });
  }
  return withSpotifyAccessToken((accessToken) =>
    spotifyWebApiProvider.searchArtists(accessToken, query, offset),
  );
}
