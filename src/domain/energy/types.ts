/**
 * Energy curve domain types.
 *
 * The energy editor turns a teacher's intended class arc into a
 * time-indexed target function E(t) -> [0, 100].
 *
 * Spec: 04_ENERGY_CURVE_EDITOR.md
 */

export type EnergyPoint = {
  id: string;
  timeSec: number;
  energy: number; // 0..100
  label?: string;
  locked?: boolean;
  /**
   * True when this point's energy was inferred rather than grounded in a
   * known rating — e.g. built from an imported playlist's tracks that have
   * no prior teacher energy override (05_PLAYLIST_RESHAPE.md — "Curve
   * inference algorithm"). A quiet visual distinction only, never a
   * fabricated confidence number.
   */
  estimated?: boolean;
};

export type PhaseKind =
  | "arrival"
  | "warmup"
  | "build"
  | "peak"
  | "release"
  | "savasana"
  | "custom";

export type ClassPhase = {
  id: string;
  label: string;
  startSec: number;
  endSec: number;
  kind: PhaseKind;
};

export type Interpolation = "monotone" | "linear";

export type EnergyCurve = {
  durationSec: number;
  points: EnergyPoint[];
  interpolation: Interpolation;
};

/** A point normalized to 0..1 of class duration, for template storage. */
export type NormalizedEnergyPoint = {
  x: number; // 0..1
  energy: number;
  label?: string;
  estimated?: boolean;
};

export type NormalizedPhase = {
  label: string;
  start: number; // 0..1
  end: number; // 0..1
  kind: PhaseKind;
};

export const ENERGY_MIN = 0;
export const ENERGY_MAX = 100;

/** Minimum horizontal gap (seconds) enforced between adjacent points. */
export const MIN_POINT_GAP_SEC = 5;

export type CurveValidationError =
  | { code: "EMPTY_CURVE" }
  | { code: "NON_POSITIVE_DURATION" }
  | { code: "FIRST_POINT_NOT_AT_ZERO"; timeSec: number }
  | { code: "LAST_POINT_NOT_AT_DURATION"; timeSec: number; durationSec: number }
  | { code: "ENERGY_OUT_OF_RANGE"; pointId: string; energy: number }
  | { code: "TIME_NOT_INCREASING"; pointId: string; timeSec: number }
  | { code: "POINTS_TOO_CLOSE"; pointId: string; gapSec: number };

export type CurveValidationResult =
  | { valid: true }
  | { valid: false; errors: CurveValidationError[] };
