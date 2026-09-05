/**
 * Spotify domain types used by the adapter (07_ARCHITECTURE.md — "Spotify
 * adapter"). Deliberately narrow: only fields the app actually reads.
 * Do not add Audio Features/Analysis/Recommendations fields — those
 * endpoints are unavailable for new apps (08_SPOTIFY_INTEGRATION.md).
 */

export type SpotifyUser = {
  id: string;
  displayName: string | null;
};

export type ArtistSummary = {
  id: string;
  name: string;
  imageUrl: string | null;
  genres: string[];
};

export type TrackSummary = {
  id: string;
  uri: string;
  title: string;
  artist: string;
  durationMs: number;
  imageUrl: string | null;
};

export type Page<T> = {
  items: T[];
  offset: number;
  limit: number;
  total: number;
  hasMore: boolean;
};

export type TopItemParams = {
  timeRange?: "short_term" | "medium_term" | "long_term";
  limit?: number;
};

export type CreatePlaylistInput = {
  name: string;
  description?: string;
  isPublic: boolean;
};

export type SpotifyPlaylist = {
  id: string;
  name: string;
  url: string;
};

/**
 * Normalized error shape for Spotify integration failures
 * (07_ARCHITECTURE.md — "Error handling"). Callers should branch on `code`,
 * not on HTTP status or message text.
 */
export type IntegrationErrorCode =
  | "AUTH_EXPIRED"
  | "NOT_CONNECTED"
  | "FORBIDDEN"
  | "RATE_LIMITED"
  | "QUOTA_EXCEEDED"
  | "NOT_FOUND"
  | "SPOTIFY_UNAVAILABLE"
  | "UNKNOWN";

export class SpotifyIntegrationError extends Error {
  code: IntegrationErrorCode;
  retryAfterSec?: number;

  constructor(code: IntegrationErrorCode, message: string, retryAfterSec?: number) {
    super(message);
    this.name = "SpotifyIntegrationError";
    this.code = code;
    this.retryAfterSec = retryAfterSec;
  }
}

export type StoredSpotifyTokens = {
  accessToken: string;
  refreshToken: string;
  /** epoch ms */
  expiresAt: number;
};
