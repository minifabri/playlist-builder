import { energyLabel } from "@/domain/energy";

/**
 * Curated Spotify Search `genre:` seeds per qualitative energy label
 * (energyLabel.ts — Still/Grounded/Flowing/Driving/Peak). This is
 * app-owned editorial data, not derived from Spotify Content or any
 * Audio Features/Recommendations signal — those are unavailable for new
 * apps (08_SPOTIFY_INTEGRATION.md). It only ever feeds the public Search
 * endpoint, which is allowed.
 *
 * The listener's own top genres (an explicit, deterministic preference
 * signal — also sanctioned by the AI/data policy in
 * 08_SPOTIFY_INTEGRATION.md) are preferred over the curated pool whenever
 * one plausibly fits the current mood.
 */
const MOOD_GENRE_SEEDS: Record<string, string[]> = {
  Still: ["ambient", "meditation", "new age"],
  Grounded: ["chillout", "downtempo", "acoustic"],
  Flowing: ["indie folk", "nu jazz", "chill pop"],
  Driving: ["deep house", "afrobeat", "indie pop"],
  Peak: ["house", "dance pop", "electronica"],
};

export type MoodSuggestionSeed = {
  moodLabel: string;
  genre: string;
  /** true when the genre came from the listener's own top genres. */
  personalized: boolean;
};

/**
 * Pick a search genre for a given target energy value. Prefers a genre
 * the listener already likes when it plausibly matches the current mood's
 * curated pool, otherwise cycles through that pool using `rotation`
 * (used by a "shuffle" control so the same mood doesn't always suggest
 * the same genre).
 */
export function pickMoodSuggestionSeed(
  targetEnergy: number,
  topGenres: string[],
  rotation = 0,
): MoodSuggestionSeed {
  const moodLabel = energyLabel(targetEnergy);
  const pool = MOOD_GENRE_SEEDS[moodLabel] ?? MOOD_GENRE_SEEDS.Flowing;

  const personalMatch = topGenres.find((g) => {
    const lower = g.toLowerCase();
    return pool.some((seed) => lower.includes(seed) || seed.includes(lower));
  });

  if (personalMatch) {
    return { moodLabel, genre: personalMatch, personalized: true };
  }
  return { moodLabel, genre: pool[rotation % pool.length], personalized: false };
}
