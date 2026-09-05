import type {
  EnergyCurve,
  EnergyPoint,
  NormalizedEnergyPoint,
  NormalizedPhase,
  ClassPhase,
} from "./types";

/**
 * Normalize a curve to 0..1 time fractions for template storage.
 * Spec: 04_ENERGY_CURVE_EDITOR.md — "Duration scaling".
 */
export function normalizeCurve(curve: EnergyCurve): NormalizedEnergyPoint[] {
  if (curve.durationSec <= 0) {
    return curve.points.map((p) => ({ x: 0, energy: p.energy, label: p.label }));
  }
  return curve.points.map((p) => ({
    x: p.timeSec / curve.durationSec,
    energy: p.energy,
    label: p.label,
  }));
}

let pointCounter = 0;
function nextId(prefix: string): string {
  pointCounter += 1;
  return `${prefix}-${Date.now().toString(36)}-${pointCounter}`;
}

/**
 * Apply a normalized template curve to a new duration.
 * Positions scale proportionally; energies are preserved verbatim.
 */
export function applyCurveToDuration(
  normalizedPoints: NormalizedEnergyPoint[],
  durationSec: number,
  interpolation: EnergyCurve["interpolation"] = "monotone",
): EnergyCurve {
  const points: EnergyPoint[] = normalizedPoints.map((p) => ({
    id: nextId("pt"),
    timeSec: Math.round(p.x * durationSec),
    energy: p.energy,
    label: p.label,
  }));

  // Guard the invariant that first/last points sit exactly at the edges,
  // even after rounding.
  if (points.length > 0) {
    points[0].timeSec = 0;
    points[points.length - 1].timeSec = durationSec;
  }

  return { durationSec, points, interpolation };
}

/**
 * Rescale an existing curve to a new duration, preserving the relative
 * (normalized) shape of the arc. This is the "Scale structure
 * proportionally" behavior from 02_UX_AND_USER_FLOWS.md.
 */
export function scaleCurveToDuration(
  curve: EnergyCurve,
  newDurationSec: number,
): EnergyCurve {
  const normalized = normalizeCurve(curve);
  return applyCurveToDuration(normalized, newDurationSec, curve.interpolation);
}

export function normalizePhases(
  phases: ClassPhase[],
  durationSec: number,
): NormalizedPhase[] {
  if (durationSec <= 0) {
    return phases.map((ph) => ({
      label: ph.label,
      start: 0,
      end: 0,
      kind: ph.kind,
    }));
  }
  return phases.map((ph) => ({
    label: ph.label,
    start: ph.startSec / durationSec,
    end: ph.endSec / durationSec,
    kind: ph.kind,
  }));
}

export function applyPhasesToDuration(
  normalizedPhases: NormalizedPhase[],
  durationSec: number,
): ClassPhase[] {
  return normalizedPhases.map((ph) => ({
    id: nextId("phase"),
    label: ph.label,
    startSec: Math.round(ph.start * durationSec),
    endSec: Math.round(ph.end * durationSec),
    kind: ph.kind,
  }));
}
