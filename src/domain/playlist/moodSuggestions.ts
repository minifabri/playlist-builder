import { energyLabel } from "@/domain/energy";

/**
 * Curated Spotify Search `genre:` seeds per qualitative energy label
 * (energyLabel.ts — Still/Grounded/Flowing/Driving/Peak), picked to be
 * appropriate for a yoga class at that intensity — not just "whatever the
 * listener happens to stream elsewhere". This is app-owned editorial
 * data, not derived from Spotify Content or any Audio
 * Features/Recommendations signal — those are unavailable for new apps
 * (08_SPOTIFY_INTEGRATION.md). It only ever feeds the public Search
 * endpoint, which is allowed. Deliberately excludes generic
 * pop/rock-adjacent tags — a teacher's own mainstream listening habits
 * are not automatically a good match for the room.
 */
const YOGA_GENRE_POOL: Record<string, string[]> = {
  Still: ["ambient", "meditation", "new age", "drone", "healing", "singing bowls"],
  Grounded: ["yoga", "chillout", "downtempo", "lo-fi", "world", "acoustic"],
  Flowing: ["indie folk", "nu jazz", "neo soul", "bossa nova", "world fusion", "chillwave"],
  Driving: ["deep house", "afrobeat", "organic house", "tribal house", "afro house", "global bass"],
  Peak: ["house", "electronica", "afro house", "yoga beats", "tropical house", "world electronic"],
};

/** All curated genres/subgenres across every mood, deduplicated — the
 * pool a "which genres should we suggest from" picker offers. */
export const ALL_YOGA_GENRES: string[] = Array.from(
  new Set(Object.values(YOGA_GENRE_POOL).flat()),
);

export type MoodSuggestionSeed = {
  moodLabel: string;
  genre: string;
  /** true when the picked genre is one the teacher explicitly selected. */
  personalized: boolean;
};

export type GenrePreferences = {
  /**
   * Genres the teacher has explicitly opted into (multi-select picker,
   * usually a subset of ALL_YOGA_GENRES). Empty/omitted = no
   * restriction — use the full curated pool for the mood.
   */
  preferredGenres?: string[];
  /**
   * Genres that must never be suggested, whatever the mood — e.g. genres
   * from the teacher's real Spotify top genres that don't belong in a
   * yoga class (pop, rock, hip hop...). Always wins over preferredGenres.
   */
  excludedGenres?: string[];
};

/**
 * Pick a search genre for a given target energy value, honoring the
 * teacher's own genre preferences. Preferred genres narrow the curated
 * pool for this mood down to just her picks (or, if none of her picks
 * belong to this mood's curated pool, use her picks directly rather than
 * silently ignoring her choice); excluded genres are removed at every
 * step and never resurface, even as a last-resort fallback. `rotation`
 * cycles through whatever pool results (used by a "shuffle" control so
 * the same mood doesn't always suggest the same genre).
 */
export function pickMoodSuggestionSeed(
  targetEnergy: number,
  preferences: GenrePreferences = {},
  rotation = 0,
): MoodSuggestionSeed {
  const { preferredGenres = [], excludedGenres = [] } = preferences;
  const moodLabel = energyLabel(targetEnergy);
  const basePool = YOGA_GENRE_POOL[moodLabel] ?? YOGA_GENRE_POOL.Flowing;

  const excludedLower = new Set(excludedGenres.map((g) => g.toLowerCase()));
  const notExcluded = (g: string) => !excludedLower.has(g.toLowerCase());
  const bandPool = basePool.filter(notExcluded);

  let pool: string[];
  if (preferredGenres.length > 0) {
    const preferredLower = new Set(preferredGenres.map((g) => g.toLowerCase()));
    const restricted = bandPool.filter((g) => preferredLower.has(g.toLowerCase()));
    const preferredAnywhere = preferredGenres.filter(notExcluded);
    pool = restricted.length > 0 ? restricted : preferredAnywhere;
  } else {
    pool = bandPool;
  }

  if (pool.length === 0) pool = bandPool.length > 0 ? bandPool : ["ambient"];

  const index = ((rotation % pool.length) + pool.length) % pool.length;
  const genre = pool[index];

  return {
    moodLabel,
    genre,
    personalized: preferredGenres.some((g) => g.toLowerCase() === genre.toLowerCase()),
  };
}
