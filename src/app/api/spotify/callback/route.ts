import { NextRequest, NextResponse } from "next/server";
import { exchangeCodeForTokens } from "@/integrations/spotify/spotifyOAuth";
import { consumeOAuthStateCookie, setSpotifySessionCookie } from "@/lib/spotifySession";

/**
 * OAuth callback (08_SPOTIFY_INTEGRATION.md — "OAuth: server-side callback
 * and token exchange"). Validates CSRF state, exchanges the code, stores
 * the encrypted session cookie, then redirects back to whichever page
 * started the connect flow.
 */
export async function GET(request: NextRequest) {
  const { searchParams, origin } = request.nextUrl;
  const code = searchParams.get("code");
  const state = searchParams.get("state");
  const spotifyError = searchParams.get("error");

  const consumed = await consumeOAuthStateCookie(state);
  const returnTo = consumed?.returnTo ?? "/";

  if (spotifyError) {
    return NextResponse.redirect(
      `${origin}${returnTo}?spotify=error&reason=denied`,
    );
  }
  if (!consumed) {
    return NextResponse.redirect(
      `${origin}${returnTo}?spotify=error&reason=state_mismatch`,
    );
  }
  if (!code) {
    return NextResponse.redirect(
      `${origin}${returnTo}?spotify=error&reason=missing_code`,
    );
  }

  try {
    const tokens = await exchangeCodeForTokens(code);
    await setSpotifySessionCookie(tokens);
  } catch {
    return NextResponse.redirect(
      `${origin}${returnTo}?spotify=error&reason=token_exchange_failed`,
    );
  }

  return NextResponse.redirect(`${origin}${returnTo}?spotify=connected`);
}
