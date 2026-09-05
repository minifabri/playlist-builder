import { sampleEnergyAt } from "@/domain/energy/sampleTargetEnergy";
import type { EnergyCurve } from "@/domain/energy/types";
import { MOCK_TRACK_POOL } from "./mockTracks";
import type { DraftTrack } from "./types";

/**
 * Build an initial ordered track list from the local mock pool by
 * repeatedly picking the closest-energy-fit remaining track for the
 * current cumulative position, stopping once the target duration is
 * reached (within tolerance) or the pool is exhausted.
 *
 * This is a placeholder "nearest fit" picker for the Phase 0 vertical
 * slice — it is NOT the scoring/generation engine from
 * 05_PLAYLIST_ENGINE.md (no taste/phase/transition fit, no Spotify
 * candidates). That engine is scoped to a later phase. Tracks produced
 * here are always source: "mock" and cannot be exported to Spotify —
 * use track search to add real, exportable tracks to the draft.
 */
export function generateMockDraft(curve: EnergyCurve): DraftTrack[] {
  const remaining = [...MOCK_TRACK_POOL];
  const order: DraftTrack[] = [];
  let cursorMs = 0;
  const targetMs = curve.durationSec * 1000;

  while (remaining.length > 0 && cursorMs < targetMs) {
    const midpointSec = (cursorMs + 120_000) / 1000; // assume ~4min lookahead
    const target = sampleEnergyAt(curve, midpointSec);

    let bestIndex = 0;
    let bestDelta = Infinity;
    remaining.forEach((track, i) => {
      const delta = Math.abs(track.energyEstimate - target);
      if (delta < bestDelta) {
        bestDelta = delta;
        bestIndex = i;
      }
    });

    const [chosen] = remaining.splice(bestIndex, 1);
    order.push({
      id: chosen.id,
      source: "mock",
      title: chosen.title,
      artist: chosen.artist,
      durationMs: chosen.durationMs,
      energyEstimate: chosen.energyEstimate,
      vocalsLevel: chosen.vocalsLevel,
      locked: false,
    });
    cursorMs += chosen.durationMs;
  }

  return order;
}
