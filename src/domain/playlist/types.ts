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
