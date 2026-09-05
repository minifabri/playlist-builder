import { describe, expect, it } from "vitest";
import { mapSpotifyErrorResponse } from "./spotifyErrors";

function fakeResponse(status: number, body?: unknown, headers?: Record<string, string>) {
  return new Response(body ? JSON.stringify(body) : undefined, {
    status,
    headers,
  });
}

describe("mapSpotifyErrorResponse", () => {
  it("maps 401 to AUTH_EXPIRED", async () => {
    const err = await mapSpotifyErrorResponse(fakeResponse(401));
    expect(err.code).toBe("AUTH_EXPIRED");
  });

  it("maps 403 to FORBIDDEN", async () => {
    const err = await mapSpotifyErrorResponse(fakeResponse(403));
    expect(err.code).toBe("FORBIDDEN");
  });

  it("maps 404 to NOT_FOUND", async () => {
    const err = await mapSpotifyErrorResponse(fakeResponse(404));
    expect(err.code).toBe("NOT_FOUND");
  });

  it("maps plain 429 to RATE_LIMITED", async () => {
    const err = await mapSpotifyErrorResponse(
      fakeResponse(429, { error: { message: "rate limited" } }),
    );
    expect(err.code).toBe("RATE_LIMITED");
  });

  it("distinguishes QUOTA_EXCEEDED from ordinary 429s via the structured reason", async () => {
    const err = await mapSpotifyErrorResponse(
      fakeResponse(429, { error: { reason: "QUOTA_EXCEEDED" } }, { "Retry-After": "120" }),
    );
    expect(err.code).toBe("QUOTA_EXCEEDED");
    expect(err.retryAfterSec).toBe(120);
  });

  it("maps 5xx to SPOTIFY_UNAVAILABLE", async () => {
    const err = await mapSpotifyErrorResponse(fakeResponse(503));
    expect(err.code).toBe("SPOTIFY_UNAVAILABLE");
  });

  it("falls back to UNKNOWN for unrecognized statuses", async () => {
    const err = await mapSpotifyErrorResponse(fakeResponse(418));
    expect(err.code).toBe("UNKNOWN");
  });
});
