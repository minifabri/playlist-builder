import { cookies } from "next/headers";
import { decryptFromCookieValue, encryptToCookieValue } from "./tokenCrypto";
import { refreshAccessToken } from "@/integrations/spotify/spotifyOAuth";
import type { StoredSpotifyTokens } from "@/integrations/spotify/types";

/**
 * Server-side Spotify session, held as an encrypted HttpOnly cookie
 * (07_ARCHITECTURE.md — "Auth strategy": secure, HttpOnly, SameSite
 * cookies for session; encrypt tokens at rest; refresh server-side).
 * No database — this MVP's whole "session store" is this one cookie,
 * consistent with the localStorage-only persistence used elsewhere in
 * this vertical slice (11_ENV_AND_SETUP.md — in-memory/mock repository is
 * acceptable for the early UI slice).
 */

const SESSION_COOKIE = "spotify_session";
const STATE_COOKIE = "spotify_oauth_state";
const REFRESH_MARGIN_MS = 60_000;

const cookieBaseOptions = {
  httpOnly: true,
  secure: true,
  sameSite: "lax" as const,
  path: "/",
};

export async function setSpotifySessionCookie(
  tokens: StoredSpotifyTokens,
): Promise<void> {
  const store = await cookies();
  const encrypted = encryptToCookieValue(JSON.stringify(tokens));
  store.set(SESSION_COOKIE, encrypted, {
    ...cookieBaseOptions,
    // Cookie lifetime outlives the access token — refresh happens
    // transparently via getValidAccessToken() using the refresh token.
    maxAge: 60 * 60 * 24 * 30,
  });
}

export async function clearSpotifySessionCookie(): Promise<void> {
  const store = await cookies();
  store.delete(SESSION_COOKIE);
}

async function getStoredTokens(): Promise<StoredSpotifyTokens | null> {
  const store = await cookies();
  const raw = store.get(SESSION_COOKIE)?.value;
  if (!raw) return null;
  const decrypted = decryptFromCookieValue(raw);
  if (!decrypted) return null;
  try {
    return JSON.parse(decrypted) as StoredSpotifyTokens;
  } catch {
    return null;
  }
}

export async function isSpotifyConnected(): Promise<boolean> {
  return (await getStoredTokens()) !== null;
}

/**
 * Returns a currently-valid access token, refreshing it first if it's
 * expired or about to expire. Returns null when there's no session at all
 * (never connected / already disconnected) or refresh itself fails (e.g.
 * the user revoked access on Spotify's side) — callers should treat null
 * as AUTH_EXPIRED and prompt reconnect, clearing the stale cookie.
 */
export async function getValidAccessToken(): Promise<string | null> {
  const stored = await getStoredTokens();
  if (!stored) return null;

  if (stored.expiresAt - Date.now() > REFRESH_MARGIN_MS) {
    return stored.accessToken;
  }

  try {
    const refreshed = await refreshAccessToken(stored.refreshToken);
    await setSpotifySessionCookie(refreshed);
    return refreshed.accessToken;
  } catch {
    await clearSpotifySessionCookie();
    return null;
  }
}

/** Value stored is JSON {state, returnTo} — see connect/route.ts. */
export async function setOAuthStateCookie(value: string): Promise<void> {
  const store = await cookies();
  store.set(STATE_COOKIE, value, {
    ...cookieBaseOptions,
    maxAge: 60 * 10, // the OAuth round trip should complete within minutes
  });
}

/**
 * Reads and clears the CSRF state cookie, returning the stored returnTo
 * path only if the state matches what Spotify sent back
 * (07_ARCHITECTURE.md — "Security: CSRF protection around OAuth, state
 * validation"). Returns null on any mismatch or missing/malformed cookie.
 */
export async function consumeOAuthStateCookie(
  receivedState: string | null,
): Promise<{ returnTo: string } | null> {
  const store = await cookies();
  const raw = store.get(STATE_COOKIE)?.value;
  store.delete(STATE_COOKIE);
  if (!raw || !receivedState) return null;
  try {
    const parsed = JSON.parse(raw) as { state: string; returnTo: string };
    if (parsed.state !== receivedState) return null;
    return { returnTo: parsed.returnTo };
  } catch {
    return null;
  }
}
