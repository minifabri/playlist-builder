import { randomBytes } from "node:crypto";
import { NextRequest, NextResponse } from "next/server";
import { buildSpotifyAuthorizeUrl } from "@/integrations/spotify/spotifyOAuth";
import { setOAuthStateCookie } from "@/lib/spotifySession";

/**
 * Begins the Authorization Code flow (08_SPOTIFY_INTEGRATION.md — "OAuth").
 * `returnTo` lets the caller come back to whatever page started the
 * connect flow (e.g. a specific session editor) once it's done.
 */
export async function GET(request: NextRequest) {
  const returnTo = request.nextUrl.searchParams.get("returnTo") ?? "/";
  // Only ever redirect back within this app.
  const safeReturnTo = returnTo.startsWith("/") ? returnTo : "/";

  const state = randomBytes(16).toString("hex");
  await setOAuthStateCookie(JSON.stringify({ state, returnTo: safeReturnTo }));

  return NextResponse.redirect(buildSpotifyAuthorizeUrl(state));
}
