import { calculatePlacements } from "./calculatePlacements";
import type { DraftTrack } from "./types";
import type { EnergyCurve } from "@/domain/energy/types";

export type DraftSegment =
  | { type: "locked"; track: DraftTrack }
  | { type: "gap"; startSec: number; endSec: number };

/**
 * Splits a draft into the sequence "Generate playlist" should follow:
 * locked 🔒 tracks, kept exactly as-is and in their existing relative
 * order, and the time gaps around/between them that need fresh tracks.
 *
 * A gap's [startSec, endSec) window comes from the *current* draft's
 * placements (calculatePlacements) — i.e. how much time is actually
 * available before the next locked track, or before the end of the
 * class if there is none. Every unlocked track already in the draft is
 * treated as replaceable filler and collapsed into that one gap,
 * whatever its own count or durations were — "Generate playlist"
 * replaces all of it with a fresh pick for the same time budget.
 */
export function planDraftSegments(
  order: DraftTrack[],
  curve: EnergyCurve,
): DraftSegment[] {
  const placements = calculatePlacements(order, curve);
  const segments: DraftSegment[] = [];
  let gapStartSec = 0;

  for (let i = 0; i < order.length; i++) {
    const track = order[i];
    if (!track.locked) continue;
    const startSec = placements[i].startMs / 1000;
    if (startSec > gapStartSec) {
      segments.push({ type: "gap", startSec: gapStartSec, endSec: startSec });
    }
    segments.push({ type: "locked", track });
    gapStartSec = placements[i].endMs / 1000;
  }

  if (curve.durationSec > gapStartSec) {
    segments.push({ type: "gap", startSec: gapStartSec, endSec: curve.durationSec });
  }

  return segments;
}
