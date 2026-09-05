import { NextResponse } from "next/server";
import { getValidAccessToken } from "@/lib/spotifySession";
import { spotifyWebApiProvider } from "@/integrations/spotify/SpotifyWebApiProvider";

/**
 * Connection status, including the connected account's display name so the
 * UI can show "Connected as <name>" rather than a generic "Connected"
 * (08_SPOTIFY_INTEGRATION.md — "User profile caveat": display_name is
 * fine to depend on, unlike email/country/product).
 */
export async function GET() {
  const accessToken = await getValidAccessToken();
  if (!accessToken) {
    return NextResponse.json({ connected: false, displayName: null });
  }
  try {
    const user = await spotifyWebApiProvider.getCurrentUser(accessToken);
    return NextResponse.json({ connected: true, displayName: user.displayName });
  } catch {
    // Still connected (we have a token) even if the /me call itself failed.
    return NextResponse.json({ connected: true, displayName: null });
  }
}
