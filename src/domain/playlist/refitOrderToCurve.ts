import { calculatePlacements } from "./calculatePlacements";
import type { DraftTrack } from "./types";
import type { EnergyCurve } from "@/domain/energy/types";

/**
 * Reorders the unlocked tracks in a draft so each one sits closer to the
 * energy the class arc calls for at that point — without moving any
 * locked 🔒 track, and without changing any locked track's start time.
 *
 * How: split the order into runs of consecutive unlocked tracks (locked
 * tracks are the boundaries between runs). Within each run, sort the
 * run's *slots* by the target energy the curve asks for there (from the
 * current placements — unaffected by reordering within the run, since
 * the run's total duration doesn't change) and sort the run's *tracks* by
 * their own energyEstimate, then pair them up in that order. Pairing two
 * sorted lists like this is the arrangement that minimizes the total
 * mismatch between target and estimate for that run — provably optimal
 * for 1-D values, not just a plausible heuristic.
 *
 * A track's energyEstimate is either a curated demo value (mock tracks)
 * or a neutral default / the teacher's own rating (Spotify tracks — see
 * DraftTrack.energyEstimate and 08_SPOTIFY_INTEGRATION.md: Spotify Audio
 * Features are unavailable for new apps, so nothing but a person's own
 * judgment can say how energetic a real track feels).
 */
export function refitOrderToCurve(
  order: DraftTrack[],
  curve: EnergyCurve,
): DraftTrack[] {
  if (order.length < 2) return order;

  const placements = calculatePlacements(order, curve);
  const next = [...order];

  let runStart = 0;
  for (let i = 0; i <= order.length; i++) {
    const atBoundary = i === order.length || order[i].locked;
    if (!atBoundary) continue;

    const runIndices: number[] = [];
    for (let j = runStart; j < i; j++) runIndices.push(j);

    if (runIndices.length > 1) {
      const slotsByTargetEnergy = [...runIndices].sort(
        (a, b) => placements[a].targetEnergy - placements[b].targetEnergy,
      );
      const tracksByEstimate = runIndices
        .map((idx) => order[idx])
        .sort((a, b) => a.energyEstimate - b.energyEstimate);
      slotsByTargetEnergy.forEach((slotIndex, k) => {
        next[slotIndex] = tracksByEstimate[k];
      });
    }

    runStart = i + 1; // skip past the locked track itself
  }

  return next;
}
