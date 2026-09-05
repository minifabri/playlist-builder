import { energyLabel } from "@/domain/energy";

type GenreFlavor = "organic" | "electronic";
type FlavoredGenre = { genre: string; flavor: GenreFlavor };

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
 *
 * Each entry also carries an editorial "organic vs electronic" flavor
 * tag, used to bias picks toward the Music Intent panel's Organic ↔
 * Electronic dial. Like the genre pool itself, this is a judgment call
 * we're making, not a measured audio property.
 */
const YOGA_GENRE_POOL: Record<string, FlavoredGenre[]> = {
  Still: [
    { genre: "ambient", flavor: "electronic" },
    { genre: "meditation", flavor: "organic" },
    { genre: "new age", flavor: "organic" },
    { genre: "drone", flavor: "electronic" },
    { genre: "healing", flavor: "organic" },
    { genre: "singing bowls", flavor: "organic" },
  ],
  Grounded: [
    { genre: "yoga", flavor: "organic" },
    { genre: "chillout", flavor: "electronic" },
    { genre: "downtempo", flavor: "electronic" },
    { genre: "lo-fi", flavor: "electronic" },
    { genre: "world", flavor: "organic" },
    { genre: "acoustic", flavor: "organic" },
  ],
  Flowing: [
    { genre: "indie folk", flavor: "organic" },
    { genre: "nu jazz", flavor: "organic" },
    { genre: "neo soul", flavor: "organic" },
    { genre: "bossa nova", flavor: "organic" },
    { genre: "world fusion", flavor: "organic" },
    { genre: "chillwave", flavor: "electronic" },
  ],
  Driving: [
    { genre: "deep house", flavor: "electronic" },
    { genre: "afrobeat", flavor: "organic" },
    { genre: "organic house", flavor: "organic" },
    { genre: "tribal house", flavor: "electronic" },
    { genre: "afro house", flavor: "electronic" },
    { genre: "global bass", flavor: "electronic" },
  ],
  Peak: [
    { genre: "house", flavor: "electronic" },
    { genre: "electronica", flavor: "electronic" },
    { genre: "afrobeat", flavor: "organic" },
    { genre: "yoga beats", flavor: "electronic" },
    { genre: "tropical house", flavor: "electronic" },
    { genre: "world electronic", flavor: "electronic" },
  ],
};

/** All curated genres/subgenres across every mood, deduplicated — the
 * pool a "which genres should we suggest from" picker offers. */
export const ALL_YOGA_GENRES: string[] = Array.from(
  new Set(Object.values(YOGA_GENRE_POOL).flatMap((band) => band.map((g) => g.genre))),
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
  /**
   * The Music Intent panel's Organic ↔ Electronic dial, 0..100. <=35
   * leans the pick toward organic-tagged genres, >=65 toward
   * electronic-tagged ones, the middle range leaves the full curated
   * pool alone. Never lets the bias empty the pool for a mood that only
   * has one flavor curated.
   */
  organicElectronic?: number;
  /**
   * The Music Intent panel's Soft ↔ Driving dial, 0..100. Nudges the
   * *effective* target energy up (driving) or down (soft) by a gentle
   * amount — up to about ±10 at the extremes — before mapping it to a
   * mood band. It never overrides the energy arc you drew, just leans
   * within it.
   */
  drive?: number;
};

const DRIVE_NUDGE_FACTOR = 0.2; // drive=100 -> +10, drive=0 -> -10, drive=50 -> 0

/**
 * Pick a search genre for a given target energy value, honoring the
 * teacher's genre preferences and Music Intent dials (preferredGenres,
 * excludedGenres, organicElectronic, drive). `rotation` cycles through
 * whatever pool results (used by a "shuffle" control so the same mood
 * doesn't always suggest the same genre).
 */
export function pickMoodSuggestionSeed(
  targetEnergy: number,
  preferences: GenrePreferences = {},
  rotation = 0,
): MoodSuggestionSeed {
  const { preferredGenres = [], excludedGenres = [], organicElectronic, drive } = preferences;

  const nudge = typeof drive === "number" ? (drive - 50) * DRIVE_NUDGE_FACTOR : 0;
  const adjustedEnergy = Math.min(100, Math.max(0, targetEnergy + nudge));
  const moodLabel = energyLabel(adjustedEnergy);

  const basePool = YOGA_GENRE_POOL[moodLabel] ?? YOGA_GENRE_POOL.Flowing;
  const excludedLower = new Set(excludedGenres.map((g) => g.toLowerCase()));
  const notExcluded = (g: FlavoredGenre) => !excludedLower.has(g.genre.toLowerCase());

  // 1. This mood's curated pool, minus anything excluded.
  const bandPool = basePool.filter(notExcluded);

  // 2. Lean organic/electronic if the dial is clearly to one side — but
  // never let that empty the pool for a mood that's only curated one way.
  const wantsOrganic = typeof organicElectronic === "number" && organicElectronic <= 35;
  const wantsElectronic = typeof organicElectronic === "number" && organicElectronic >= 65;
  const flavorPool =
    wantsOrganic || wantsElectronic
      ? bandPool.filter((g) => g.flavor === (wantsOrganic ? "organic" : "electronic"))
      : bandPool;
  const shortlist = flavorPool.length > 0 ? flavorPool : bandPool;

  // 3. If she's picked specific genres, narrow to those that fit here; if
  // none of her picks fit this mood band, use her picks directly rather
  // than silently ignoring her choice.
  let pool: string[];
  if (preferredGenres.length > 0) {
    const preferredLower = new Set(preferredGenres.map((g) => g.toLowerCase()));
    const restricted = shortlist.filter((g) => preferredLower.has(g.genre.toLowerCase()));
    const preferredAnywhere = preferredGenres.filter((g) => !excludedLower.has(g.toLowerCase()));
    pool = restricted.length > 0 ? restricted.map((g) => g.genre) : preferredAnywhere;
  } else {
    pool = shortlist.map((g) => g.genre);
  }

  if (pool.length === 0) pool = bandPool.length > 0 ? bandPool.map((g) => g.genre) : ["ambient"];

  const index = ((rotation % pool.length) + pool.length) % pool.length;
  const genre = pool[index];

  return {
    moodLabel,
    genre,
    personalized: preferredGenres.some((g) => g.toLowerCase() === genre.toLowerCase()),
  };
}

/**
 * Whether the suggestion search should ask for instrumental-leaning
 * results. There's no real audio-feature signal available (Spotify
 * Audio Features are unavailable to new apps), but Spotify's own search
 * does respond reasonably to a plain "instrumental" keyword — many
 * tracks/albums are literally tagged that way — so this is a legitimate,
 * honest use of full-text search rather than a fabricated audio claim.
 */
export function wantsInstrumentalSearch(vocals?: number): boolean {
  return typeof vocals === "number" && vocals <= 30;
}

/** Builds the actual Spotify search query for a suggestion genre pick,
 * applying the Instrumental ↔ Vocal dial. */
export function buildSuggestionSearchQuery(genre: string, vocals?: number): string {
  const base = `genre:"${genre}"`;
  return wantsInstrumentalSearch(vocals) ? `${base} instrumental` : base;
}

/**
 * Re-orders already-fetched search results so tracks by an artist the
 * teacher already listens to surface first when the Discovery ↔ Familiar
 * dial leans "Familiar", or get pushed down (favoring new names) when it
 * leans "Discovery". Near the middle (within 15 of 50) leaves Spotify's
 * own search ranking untouched. This only re-sorts results we already
 * have — it never changes which tracks are fetched.
 */
export function rankByFamiliarity<T extends { artist: string }>(
  tracks: T[],
  topArtistNames: string[],
  familiarity?: number,
): T[] {
  if (typeof familiarity !== "number" || Math.abs(familiarity - 50) < 15) return tracks;
  const known = new Set(topArtistNames.map((n) => n.toLowerCase()));
  const isKnown = (t: T) => known.has(t.artist.toLowerCase());
  const preferKnown = familiarity > 50;
  return [...tracks].sort((a, b) => {
    const aKnown = isKnown(a);
    const bKnown = isKnown(b);
    if (aKnown === bKnown) return 0;
    if (preferKnown) return aKnown ? -1 : 1;
    return aKnown ? 1 : -1;
  });
}
