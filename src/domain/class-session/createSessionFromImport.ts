import type { ClassPhase } from "@/domain/energy/types";
import type { DraftTrack } from "@/domain/playlist/types";
import { inferCurveFromImport, type ImportTrackEnergyInput } from "./inferCurveFromImport";
import { DEFAULT_MUSIC_INTENT, type ClassSession, type PlaylistImport } from "./types";

/** Neutral default energy for a track with no known rating
 * (05_PLAYLIST_RESHAPE.md — "Initial energy estimation"). This app does
 * not yet persist a cross-session TrackProfile.energyOverride store, so
 * every imported track resolves to this branch today; the lookup point is
 * kept isolated here so a future per-track override store only needs to
 * change this one function.
 */
const NEUTRAL_ENERGY = 50;

function newId(prefix: string): string {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID();
  }
  return `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}

/**
 * Builds the ClassSession + initial PlaylistDraft order for the "Import a
 * playlist" entry point (05_PLAYLIST_RESHAPE.md). The curve is inferred
 * from the imported tracks' own (currently always-neutral) energy
 * estimates; no phase bands are inferred — a single unlabeled band spans
 * the full duration, same as the "Custom" preset.
 */
export function createSessionFromImport(playlistImport: PlaylistImport): {
  session: ClassSession;
  order: DraftTrack[];
} {
  const now = new Date().toISOString();

  const energyInputs: ImportTrackEnergyInput[] = playlistImport.trackSnapshot.map((t) => ({
    spotifyTrackId: t.spotifyTrackId,
    durationMs: t.durationMs,
    energy: NEUTRAL_ENERGY,
    estimated: true,
  }));
  const curve = inferCurveFromImport(energyInputs);

  const phases: ClassPhase[] = [
    { id: newId("phase"), label: "Class", kind: "custom", startSec: 0, endSec: curve.durationSec },
  ];

  const order: DraftTrack[] = playlistImport.trackSnapshot.map((t) => ({
    id: t.spotifyTrackId,
    source: "spotify",
    spotifyUri: t.uri,
    title: t.title,
    artist: t.artist,
    durationMs: t.durationMs,
    energyEstimate: NEUTRAL_ENERGY,
    vocalsLevel: 50,
    locked: false,
    estimated: true,
    origin: { importId: playlistImport.id, playlistName: playlistImport.originalName },
  }));

  const session: ClassSession = {
    id: newId("session"),
    title: `${playlistImport.originalName} (Reshaped)`,
    classType: "custom",
    durationSec: curve.durationSec,
    status: "draft",
    curve,
    phases,
    musicIntent: { ...DEFAULT_MUSIC_INTENT },
    sourceType: "import",
    importId: playlistImport.id,
    createdAt: now,
    updatedAt: now,
  };

  return { session, order };
}
