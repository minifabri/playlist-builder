import { NextResponse } from "next/server";
import { getValidAccessToken } from "./spotifySession";
import { SpotifyIntegrationError } from "@/integrations/spotify/types";

const STATUS_BY_CODE: Record<string, number> = {
  AUTH_EXPIRED: 401,
  NOT_CONNECTED: 401,
  FORBIDDEN: 403,
  RATE_LIMITED: 429,
  QUOTA_EXCEEDED: 429,
  NOT_FOUND: 404,
  SPOTIFY_UNAVAILABLE: 503,
  UNKNOWN: 502,
};

/**
 * Shared shell for /api/music/* and /api/sessions/:id/export route
 * handlers: resolves a valid access token (refreshing if needed), runs the
 * handler, and maps any SpotifyIntegrationError to a normalized JSON error
 * body + HTTP status (07_ARCHITECTURE.md — "Error handling").
 */
export async function withSpotifyAccessToken<T>(
  handler: (accessToken: string) => Promise<T>,
): Promise<NextResponse> {
  const accessToken = await getValidAccessToken();
  if (!accessToken) {
    return NextResponse.json(
      { code: "NOT_CONNECTED", message: "Spotify not connected." },
      { status: 401 },
    );
  }
  try {
    const data = await handler(accessToken);
    return NextResponse.json(data);
  } catch (err) {
    if (err instanceof SpotifyIntegrationError) {
      const status = STATUS_BY_CODE[err.code] ?? 502;
      return NextResponse.json(
        {
          code: err.code,
          message: err.message,
          retryAfterSec: err.retryAfterSec,
        },
        { status },
      );
    }
    return NextResponse.json(
      { code: "UNKNOWN", message: "Unexpected error." },
      { status: 502 },
    );
  }
}
