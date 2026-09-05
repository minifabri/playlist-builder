import {
  ENERGY_MAX,
  ENERGY_MIN,
  MIN_POINT_GAP_SEC,
  type CurveValidationError,
  type CurveValidationResult,
  type EnergyCurve,
} from "./types";

/**
 * Validate an energy curve against the invariants defined in
 * 04_ENERGY_CURVE_EDITOR.md:
 * - first point time = 0
 * - last point time = duration
 * - energy always between 0 and 100
 * - point times strictly increasing
 * - no duplicate timestamps / minimum horizontal gap
 * - duration > 0
 */
export function validateCurve(curve: EnergyCurve): CurveValidationResult {
  const errors: CurveValidationError[] = [];

  if (curve.durationSec <= 0) {
    errors.push({ code: "NON_POSITIVE_DURATION" });
  }

  if (curve.points.length === 0) {
    errors.push({ code: "EMPTY_CURVE" });
    return { valid: false, errors };
  }

  const first = curve.points[0];
  if (first.timeSec !== 0) {
    errors.push({ code: "FIRST_POINT_NOT_AT_ZERO", timeSec: first.timeSec });
  }

  const last = curve.points[curve.points.length - 1];
  if (curve.durationSec > 0 && last.timeSec !== curve.durationSec) {
    errors.push({
      code: "LAST_POINT_NOT_AT_DURATION",
      timeSec: last.timeSec,
      durationSec: curve.durationSec,
    });
  }

  for (const point of curve.points) {
    if (point.energy < ENERGY_MIN || point.energy > ENERGY_MAX) {
      errors.push({
        code: "ENERGY_OUT_OF_RANGE",
        pointId: point.id,
        energy: point.energy,
      });
    }
  }

  for (let i = 1; i < curve.points.length; i++) {
    const prev = curve.points[i - 1];
    const curr = curve.points[i];

    if (curr.timeSec <= prev.timeSec) {
      errors.push({
        code: "TIME_NOT_INCREASING",
        pointId: curr.id,
        timeSec: curr.timeSec,
      });
      continue;
    }

    const gap = curr.timeSec - prev.timeSec;
    if (gap < MIN_POINT_GAP_SEC) {
      errors.push({
        code: "POINTS_TOO_CLOSE",
        pointId: curr.id,
        gapSec: gap,
      });
    }
  }

  return errors.length === 0 ? { valid: true } : { valid: false, errors };
}

export function clampEnergy(energy: number): number {
  return Math.min(ENERGY_MAX, Math.max(ENERGY_MIN, energy));
}

export function clampTime(timeSec: number, durationSec: number): number {
  return Math.min(durationSec, Math.max(0, timeSec));
}
