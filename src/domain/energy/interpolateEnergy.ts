import { ENERGY_MAX, ENERGY_MIN, type EnergyCurve, type EnergyPoint } from "./types";

/**
 * Build the target energy function E(t) -> [0, 100] for a curve.
 *
 * Linear: straight segments between points.
 * Monotone: Fritsch-Carlson monotone cubic Hermite interpolation, which
 * never overshoots the value range between control points — safe for a
 * bounded 0..100 signal (spec: 04_ENERGY_CURVE_EDITOR.md).
 */
export function buildEnergyFunction(
  curve: EnergyCurve,
): (timeSec: number) => number {
  const points = [...curve.points].sort((a, b) => a.timeSec - b.timeSec);

  if (points.length === 0) {
    return () => ENERGY_MIN;
  }
  if (points.length === 1) {
    const only = points[0].energy;
    return () => clamp(only);
  }

  if (curve.interpolation === "linear") {
    return (t: number) => clamp(linearAt(points, t));
  }

  const tangents = monotoneTangents(points);
  return (t: number) => clamp(monotoneAt(points, tangents, t));
}

function clamp(value: number): number {
  return Math.min(ENERGY_MAX, Math.max(ENERGY_MIN, value));
}

function findSegment(
  points: EnergyPoint[],
  t: number,
): { i: number; j: number } {
  if (t <= points[0].timeSec) return { i: 0, j: 0 };
  const last = points.length - 1;
  if (t >= points[last].timeSec) return { i: last, j: last };

  let lo = 0;
  let hi = last;
  while (lo < hi - 1) {
    const mid = (lo + hi) >> 1;
    if (points[mid].timeSec <= t) lo = mid;
    else hi = mid;
  }
  return { i: lo, j: hi };
}

function linearAt(points: EnergyPoint[], t: number): number {
  const { i, j } = findSegment(points, t);
  if (i === j) return points[i].energy;

  const a = points[i];
  const b = points[j];
  const span = b.timeSec - a.timeSec;
  const ratio = span === 0 ? 0 : (t - a.timeSec) / span;
  return a.energy + ratio * (b.energy - a.energy);
}

/** Per-point tangent slopes (dEnergy/dTime) for monotone cubic Hermite. */
function monotoneTangents(points: EnergyPoint[]): number[] {
  const n = points.length;
  const dx: number[] = [];
  const dy: number[] = [];
  const slope: number[] = [];

  for (let i = 0; i < n - 1; i++) {
    const deltaX = points[i + 1].timeSec - points[i].timeSec;
    const deltaY = points[i + 1].energy - points[i].energy;
    dx.push(deltaX);
    dy.push(deltaY);
    slope.push(deltaX === 0 ? 0 : deltaY / deltaX);
  }

  const tangents: number[] = new Array(n).fill(0);
  tangents[0] = slope[0] ?? 0;
  tangents[n - 1] = slope[n - 2] ?? 0;

  for (let i = 1; i < n - 1; i++) {
    if (slope[i - 1] === 0 || slope[i] === 0 || slope[i - 1] * slope[i] < 0) {
      tangents[i] = 0;
    } else {
      tangents[i] = (slope[i - 1] + slope[i]) / 2;
    }
  }

  // Fritsch-Carlson step: rescale tangents so the curve stays monotone
  // (and therefore never overshoots) on every segment.
  for (let i = 0; i < n - 1; i++) {
    if (slope[i] === 0) {
      tangents[i] = 0;
      tangents[i + 1] = 0;
      continue;
    }
    const a = tangents[i] / slope[i];
    const b = tangents[i + 1] / slope[i];
    const magnitude = Math.sqrt(a * a + b * b);
    if (magnitude > 3) {
      const scale = 3 / magnitude;
      tangents[i] = scale * a * slope[i];
      tangents[i + 1] = scale * b * slope[i];
    }
  }

  return tangents;
}

function monotoneAt(
  points: EnergyPoint[],
  tangents: number[],
  t: number,
): number {
  const { i, j } = findSegment(points, t);
  if (i === j) return points[i].energy;

  const a = points[i];
  const b = points[j];
  const h = b.timeSec - a.timeSec;
  if (h === 0) return a.energy;

  const s = (t - a.timeSec) / h;
  const s2 = s * s;
  const s3 = s2 * s;

  const h00 = 2 * s3 - 3 * s2 + 1;
  const h10 = s3 - 2 * s2 + s;
  const h01 = -2 * s3 + 3 * s2;
  const h11 = s3 - s2;

  return (
    h00 * a.energy +
    h10 * h * tangents[i] +
    h01 * b.energy +
    h11 * h * tangents[j]
  );
}
