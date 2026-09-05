import { SpotifyIntegrationError, type IntegrationErrorCode } from "./types";

/**
 * Map a failed Spotify Web API response to a normalized
 * SpotifyIntegrationError (07_ARCHITECTURE.md — "Error handling",
 * 08_SPOTIFY_INTEGRATION.md — "429 handling").
 *
 * Distinguishes QUOTA_EXCEEDED from ordinary RATE_LIMITED on 429 using the
 * structured `reason` Spotify may include in the error body, per the July
 * 2026 Development Mode quota changes. Falls back to RATE_LIMITED when no
 * reason is present, since that is the safer (more retryable) assumption.
 */
export async function mapSpotifyErrorResponse(
  response: Response,
): Promise<SpotifyIntegrationError> {
  const status = response.status;
  let bodyReason: string | undefined;
  try {
    const body = (await response.clone().json()) as {
      error?: { message?: string; reason?: string };
    };
    bodyReason = body?.error?.reason ?? body?.error?.message;
  } catch {
    // body wasn't JSON — ignore, fall back to status-only mapping
  }

  if (status === 401) {
    return new SpotifyIntegrationError(
      "AUTH_EXPIRED",
      "Spotify session expired or invalid.",
    );
  }
  if (status === 403) {
    return new SpotifyIntegrationError(
      "FORBIDDEN",
      "Spotify denied this request (insufficient scope or account restriction).",
    );
  }
  if (status === 404) {
    return new SpotifyIntegrationError("NOT_FOUND", "Spotify resource not found.");
  }
  if (status === 429) {
    const retryAfterHeader = response.headers.get("Retry-After");
    const retryAfterSec = retryAfterHeader ? Number(retryAfterHeader) : undefined;
    const isQuota = bodyReason === "QUOTA_EXCEEDED";
    return new SpotifyIntegrationError(
      isQuota ? "QUOTA_EXCEEDED" : "RATE_LIMITED",
      isQuota
        ? "Spotify Development Mode quota exceeded."
        : "Too many requests to Spotify — please wait and try again.",
      retryAfterSec,
    );
  }
  if (status >= 500) {
    return new SpotifyIntegrationError(
      "SPOTIFY_UNAVAILABLE",
      "Spotify is temporarily unavailable.",
    );
  }
  return new SpotifyIntegrationError(
    "UNKNOWN" as IntegrationErrorCode,
    bodyReason ?? `Unexpected Spotify API error (${status}).`,
  );
}
