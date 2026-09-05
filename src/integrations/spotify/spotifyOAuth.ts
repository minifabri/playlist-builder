import { SpotifyIntegrationError, type StoredSpotifyTokens } from "./types";
import { SPOTIFY_SCOPE_STRING } from "./spotifyScopes";

const AUTHORIZE_URL = "https://accounts.spotify.com/authorize";
const TOKEN_URL = "https://accounts.spotify.com/api/token";

function requireEnv(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(`Missing required environment variable: ${name}`);
  }
  return value;
}

function basicAuthHeader(): string {
  const clientId = requireEnv("SPOTIFY_CLIENT_ID");
  const clientSecret = requireEnv("SPOTIFY_CLIENT_SECRET");
  return `Basic ${Buffer.from(`${clientId}:${clientSecret}`).toString("base64")}`;
}

/**
 * Build the Spotify authorize URL for the Authorization Code flow
 * (08_SPOTIFY_INTEGRATION.md — "OAuth: Authorization Code flow,
 * server-side callback and token exchange"). Never use Implicit Grant.
 */
export function buildSpotifyAuthorizeUrl(state: string): string {
  const clientId = requireEnv("SPOTIFY_CLIENT_ID");
  const redirectUri = requireEnv("SPOTIFY_REDIRECT_URI");
  const params = new URLSearchParams({
    response_type: "code",
    client_id: clientId,
    scope: SPOTIFY_SCOPE_STRING,
    redirect_uri: redirectUri,
    state,
  });
  return `${AUTHORIZE_URL}?${params.toString()}`;
}

type TokenResponse = {
  access_token: string;
  refresh_token?: string;
  expires_in: number;
  error?: string;
  error_description?: string;
};

async function requestToken(body: URLSearchParams): Promise<TokenResponse> {
  const res = await fetch(TOKEN_URL, {
    method: "POST",
    headers: {
      Authorization: basicAuthHeader(),
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body,
    cache: "no-store",
  });
  const json = (await res.json()) as TokenResponse;
  if (!res.ok || json.error) {
    throw new SpotifyIntegrationError(
      "AUTH_EXPIRED",
      json.error_description ?? `Spotify token request failed (${res.status}).`,
    );
  }
  return json;
}

export async function exchangeCodeForTokens(
  code: string,
): Promise<StoredSpotifyTokens> {
  const redirectUri = requireEnv("SPOTIFY_REDIRECT_URI");
  const json = await requestToken(
    new URLSearchParams({
      grant_type: "authorization_code",
      code,
      redirect_uri: redirectUri,
    }),
  );
  if (!json.refresh_token) {
    // Spotify always returns a refresh_token on the initial code exchange;
    // treat its absence as a hard failure rather than silently degrading
    // to an access-token-only session that can't be refreshed later.
    throw new SpotifyIntegrationError(
      "UNKNOWN",
      "Spotify did not return a refresh token.",
    );
  }
  return {
    accessToken: json.access_token,
    refreshToken: json.refresh_token,
    expiresAt: Date.now() + json.expires_in * 1000,
  };
}

/**
 * Refresh an access token. Spotify does not always return a new
 * refresh_token on refresh — when omitted, the caller must keep using the
 * previous one (this is why the previous refresh token is a parameter, not
 * assumed to still be valid only from the response).
 */
export async function refreshAccessToken(
  previousRefreshToken: string,
): Promise<StoredSpotifyTokens> {
  const json = await requestToken(
    new URLSearchParams({
      grant_type: "refresh_token",
      refresh_token: previousRefreshToken,
    }),
  );
  return {
    accessToken: json.access_token,
    refreshToken: json.refresh_token ?? previousRefreshToken,
    expiresAt: Date.now() + json.expires_in * 1000,
  };
}
