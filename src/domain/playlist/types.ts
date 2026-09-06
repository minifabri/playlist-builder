/**
 * Playlist domain types for the Phase 0 vertical slice.
 *
 * This slice ships a local mock track pool and a cumulative-duration
 * placement calculator only — the scoring/generation engine described in
 * 05_PLAYLIST_ENGINE.md is scoped to a later phase (09_MVP_SCOPE_AND_ROADMAP.md,
 * Phase 5) and is intentionally not implemented here.
 */

export type MockTrack = {
  id: string;
  title: string;
  artist: string;
  durationMs: number;
  /** App-owned estimate, 0..100 — never presented as a Spotify audio feature. */
  energyEstimate: number;
  vocalsLevel: number; // 0 instrumental .. 100 vocal
};

export type TrackPlacement = {
  trackId: string;
  position: number;
  startMs: number;
  endMs: number;
  locked: boolean;
  targetEnergy: number;
  estimatedEnergy: number;
};

/**
 * Where a draft track's data came from.
 * "mock" — the local fictional pool (mockTracks.ts), for offline prototyping.
 * "spotify" — a real track resolved via the Spotify search adapter; carries
 * a real spotifyUri and is the only kind that can be exported to Spotify
 * (08_SPOTIFY_INTEGRATION.md — create playlist / add items).
 */
export type TrackSource = "mock" | "spotify";

/**
 * A track placed in the playlist draft. Denormalized on purpose: the draft
 * rail should not need to re-resolve a track against a pool to render or
 * export it, since mock and Spotify tracks live in different sources.
 */
export type DraftTrack = {
  id: string;
  source: TrackSource;
  /** e.g. "spotify:track:...". Present only when source === "spotify". */
  spotifyUri?: string;
  title: string;
  artist: string;
  durationMs: number;
  /**
   * App-owned estimate, 0..100 — never presented as a Spotify audio feature
   * (Spotify Audio Features/Analysis are unavailable for new apps, see
   * 08_SPOTIFY_INTEGRATION.md). Spotify-sourced tracks default to a neutral
   * 50 until a future phase adds real profiling (07_ARCHITECTURE.md —
   * TrackEnergyProfiler).
   */
  energyEstimate: number;
  vocalsLevel: number; // 0 instrumental .. 100 vocal
  locked: boolean;
  /**
   * True when energyEstimate is a guess (neutral default) rather than a
   * rating the teacher actually gave — set on tracks seeded from a
   * playlist import that have no prior energy override
   * (05_PLAYLIST_RESHAPE.md — "Curve inference algorithm"). Cleared as
   * soon as the teacher rates the track herself (rateTrackEnergy).
   */
  estimated?: boolean;
  /**
   * Set on tracks seeded from a playlist import, so the draft can show a
   * "from {playlist name}" origin tag until the teacher removes/replaces
   * the track (05_PLAYLIST_RESHAPE.md — "UX behavior for imported
   * sessions"). Not cleared automatically by edits other than removal.
   */
  origin?: { importId: string; playlistName: string };
};
