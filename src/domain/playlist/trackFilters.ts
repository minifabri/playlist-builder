import type { TrackSummary } from "@/integrations/spotify/types";

/**
 * Hard include/exclude filters applied to Spotify search results before
 * they can be picked — for both "Generate playlist" and "Suggested for
 * you". Unlike the Music Intent dials (which only bias ranking/search
 * text), these actually drop candidates that don't qualify.
 *
 * Deliberately limited to fields Spotify's plain track object already
 * carries (duration_ms, popularity, explicit) — no Audio Features/
 * Analysis, which are unavailable for new apps. There is no reliable way
 * to filter for "instrumental only": that stays a search-text bias (see
 * wantsInstrumentalSearch in moodSuggestions.ts), not a hard filter here.
 */
export type TrackFilters = {
  /** Drop tracks shorter than this. Handy for cutting short interludes,
   * intros, or accidental snippets (e.g. under 30s). 0/undefined = off. */
  minDurationSec?: number;
  /** Drop tracks longer than this. 0/undefined = off. */
  maxDurationSec?: number;
  /** Drop tracks below this Spotify popularity score (0-100). Higher
   * favors well-known recordings; lower/0 allows deep cuts. undefined = off. */
  minPopularity?: number;
  /** Drop tracks Spotify flags as explicit. */
  excludeExplicit?: boolean;
};

export const DEFAULT_TRACK_FILTERS: TrackFilters = {};

export function hasActiveTrackFilters(filters: TrackFilters): boolean {
  return (
    (filters.minDurationSec ?? 0) > 0 ||
    (filters.maxDurationSec ?? 0) > 0 ||
    (filters.minPopularity ?? 0) > 0 ||
    Boolean(filters.excludeExplicit)
  );
}

export function passesTrackFilters(track: TrackSummary, filters: TrackFilters): boolean {
  if (filters.minDurationSec && track.durationMs < filters.minDurationSec * 1000) return false;
  if (filters.maxDurationSec && track.durationMs > filters.maxDurationSec * 1000) return false;
  if (filters.minPopularity && track.popularity < filters.minPopularity) return false;
  if (filters.excludeExplicit && track.explicit) return false;
  return true;
}

export function filterTracks<T extends TrackSummary>(tracks: T[], filters: TrackFilters): T[] {
  return tracks.filter((t) => passesTrackFilters(t, filters));
}
