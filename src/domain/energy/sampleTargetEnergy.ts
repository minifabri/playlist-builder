import { buildEnergyFunction } from "./interpolateEnergy";
import type { EnergyCurve } from "./types";

/**
 * Estimate the target energy for a track occupying [startSec, endSec] by
 * sampling the curve at start / 25% / midpoint / 75% / end and weighting
 * the midpoint more heavily.
 *
 * Spec: 04_ENERGY_CURVE_EDITOR.md — "Target energy for a track".
 */
export function sampleTargetEnergy(
  curve: EnergyCurve,
  startSec: number,
  endSec: number,
): number {
  const energyAt = buildEnergyFunction(curve);
  const span = endSec - startSec;

  const offsets = [0, 0.25, 0.5, 0.75, 1];
  const weights = [1, 1, 2, 1, 1];

  let weightedSum = 0;
  let totalWeight = 0;

  offsets.forEach((offset, i) => {
    const t = startSec + offset * span;
    weightedSum += energyAt(t) * weights[i];
    totalWeight += weights[i];
  });

  return weightedSum / totalWeight;
}

/** Convenience: sample the instantaneous target energy at a single time. */
export function sampleEnergyAt(curve: EnergyCurve, timeSec: number): number {
  return buildEnergyFunction(curve)(timeSec);
}
