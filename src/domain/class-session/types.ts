import type {
  ClassPhase,
  EnergyCurve,
  NormalizedEnergyPoint,
  NormalizedPhase,
} from "@/domain/energy/types";

export type ClassType =
  | "slow_flow"
  | "ashtanga"
  | "strength"
  | "flexibility"
  | "foundations"
  | "custom";

export type ClassTypePreset = {
  type: ClassType;
  label: string;
  description: string;
  normalizedPoints: NormalizedEnergyPoint[];
  normalizedPhases: NormalizedPhase[];
};

export type SessionStatus = "setup" | "draft" | "ready" | "exported";

export type MusicIntent = {
  familiarity: number; // 0 discovery .. 100 familiar
  vocals: number; // 0 instrumental .. 100 vocal
  organicElectronic: number; // 0 organic .. 100 electronic
  drive: number; // 0 soft .. 100 driving
  seedArtistNames: string[];
  moodTags: string[];
};

export const DEFAULT_MUSIC_INTENT: MusicIntent = {
  familiarity: 60,
  vocals: 50,
  organicElectronic: 30,
  drive: 50,
  seedArtistNames: [],
  moodTags: [],
};

/**
 * Where a session's curve/draft originally came from
 * (05_PLAYLIST_RESHAPE.md — "Data model additions"). "preset"/"template"
 * cover the existing create flows; "import" is the reverse flow — an
 * existing Spotify playlist's own tracks seed the curve and draft.
 */
export type SessionSourceType = "preset" | "template" | "import";

/** Local, mock-repository representation of a Class Session Draft. */
export type ClassSession = {
  id: string;
  title: string;
  classType: ClassType;
  durationSec: number;
  status: SessionStatus;
  curve: EnergyCurve;
  phases: ClassPhase[];
  musicIntent: MusicIntent;
  sourceType: SessionSourceType;
  /** Present when sourceType === "import" — the PlaylistImport this session was seeded from. */
  importId?: string;
  createdAt: string;
  updatedAt: string;
};

export const DURATION_PRESETS_MIN = [45, 60, 70, 75, 90] as const;

/**
 * A snapshot of an imported Spotify playlist's own tracks, taken at import
 * time (05_PLAYLIST_RESHAPE.md — "Data model additions"). Kept alongside
 * the ClassSession it seeded so the origin tag ("from {playlist name}") and
 * re-import context survive independently of later edits to the draft.
 */
export type PlaylistImportOwnership = "own" | "collaborative" | "foreign";

export type PlaylistImportTrackSnapshot = {
  spotifyTrackId: string;
  uri: string;
  title: string;
  artist: string;
  position: number;
  durationMs: number;
};

export type PlaylistImport = {
  id: string;
  sourceSpotifyPlaylistId: string;
  sourceOwnerSpotifyUserId?: string;
  ownership: PlaylistImportOwnership;
  originalName: string;
  originalDescription?: string;
  trackSnapshot: PlaylistImportTrackSnapshot[];
  importedAt: string;
};
