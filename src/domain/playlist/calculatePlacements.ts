import { sampleTargetEnergy } from "@/domain/energy/sampleTargetEnergy";
import type { EnergyCurve } from "@/domain/energy/types";
import type { DraftTrack, TrackPlacement } from "./types";

export type { DraftTrack } from "./types";
/** @deprecated use DraftTrack — kept as an alias so older imports don't churn. */
export type OrderedTrack = DraftTrack;

/**
 * Recalculate cumulative placements for an ordered track list.
 * A track's startMs is the cumulative duration of preceding tracks
 * (05_PLAYLIST_ENGINE.md — "Track placement"). Target energy is sampled
 * from the curve over the track's [start, end] interval.
 */
export function calculatePlacements(
  order: DraftTrack[],
  curve: EnergyCurve,
): TrackPlacement[] {
  let cursorMs = 0;
  const placements: TrackPlacement[] = [];

  order.forEach((track, index) => {
    const startMs = cursorMs;
    const endMs = cursorMs + track.durationMs;
    cursorMs = endMs;

    placements.push({
      trackId: track.id,
      position: index,
      startMs,
      endMs,
      locked: track.locked,
      targetEnergy: sampleTargetEnergy(curve, startMs / 1000, endMs / 1000),
      estimatedEnergy: track.energyEstimate,
    });
  });

  return placements;
}

export function totalDurationMs(order: DraftTrack[]): number {
  return order.reduce((sum, track) => sum + track.durationMs, 0);
}

export function formatDurationDelta(
  totalMs: number,
  targetSec: number,
): { label: string; status: "ok" | "warning" } {
  const deltaSec = Math.round(totalMs / 1000 - targetSec);
  const withinTolerance = Math.abs(deltaSec) <= 120; // ±2 min, per spec

  const abs = Math.abs(deltaSec);
  const minutes = Math.floor(abs / 60);
  const seconds = abs % 60;
  const mm = String(minutes).padStart(1, "0");
  const ss = String(seconds).padStart(2, "0");

  if (deltaSec === 0) {
    return { label: "Exact length", status: "ok" };
  }
  const direction = deltaSec > 0 ? "long" : "short";
  return {
    label: `${mm}:${ss} ${direction}`,
    status: withinTolerance ? "ok" : "warning",
  };
}
