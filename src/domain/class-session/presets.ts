import type { NormalizedPhase } from "@/domain/energy/types";
import type { ClassType, ClassTypePreset } from "./types";

/**
 * Class type presets. Energy points for Slow Flow / Ashtanga / Full Body
 * Strength are normalized from the worked examples in
 * 04_ENERGY_CURVE_EDITOR.md. Flexibility Flow, Yoga Foundations and Custom
 * are authored from the qualitative descriptions in 01_PRODUCT_BRIEF.md —
 * presets are defaults, never constraints, and are fully editable.
 */

function phases(
  entries: [label: string, kind: NormalizedPhase["kind"], start: number, end: number][],
): NormalizedPhase[] {
  return entries.map(([label, kind, start, end]) => ({ label, kind, start, end }));
}

const SLOW_FLOW: ClassTypePreset = {
  type: "slow_flow",
  label: "Slow Flow",
  description:
    "Gentle arrival, gradual build, rounded medium peak, long release, spacious final section.",
  normalizedPoints: [
    { x: 0, energy: 12 },
    { x: 0.1667, energy: 20 },
    { x: 0.4, energy: 48 },
    { x: 0.5667, energy: 66 },
    { x: 0.7, energy: 58 },
    { x: 0.8333, energy: 32 },
    { x: 0.9333, energy: 16 },
    { x: 1, energy: 8 },
  ],
  normalizedPhases: phases([
    ["Arrival", "arrival", 0, 0.1],
    ["Warm-up", "warmup", 0.1, 0.3],
    ["Build", "build", 0.3, 0.5667],
    ["Peak", "peak", 0.5667, 0.75],
    ["Release", "release", 0.75, 0.92],
    ["Savasana", "savasana", 0.92, 1],
  ]),
};

const ASHTANGA: ClassTypePreset = {
  type: "ashtanga",
  label: "Ashtanga",
  description:
    "Short arrival, steady progressive build, sustained rhythmic working section, controlled descent, calm ending.",
  normalizedPoints: [
    { x: 0, energy: 18 },
    { x: 0.1, energy: 30 },
    { x: 0.2571, energy: 52 },
    { x: 0.4571, energy: 70 },
    { x: 0.7143, energy: 76 },
    { x: 0.8286, energy: 55 },
    { x: 0.9286, energy: 25 },
    { x: 1, energy: 10 },
  ],
  normalizedPhases: phases([
    ["Arrival", "arrival", 0, 0.07],
    ["Warm-up", "warmup", 0.07, 0.2],
    ["Build", "build", 0.2, 0.4571],
    ["Peak", "peak", 0.4571, 0.8],
    ["Release", "release", 0.8, 0.93],
    ["Savasana", "savasana", 0.93, 1],
  ]),
};

const STRENGTH: ClassTypePreset = {
  type: "strength",
  label: "Full Body Strength",
  description:
    "Short warm-up, faster build, long high-energy plateau, clear cooldown, quieter finish.",
  normalizedPoints: [
    { x: 0, energy: 20 },
    { x: 0.1, energy: 36 },
    { x: 0.25, energy: 68 },
    { x: 0.4, energy: 82 },
    { x: 0.7333, energy: 84 },
    { x: 0.85, energy: 55 },
    { x: 0.95, energy: 24 },
    { x: 1, energy: 12 },
  ],
  normalizedPhases: phases([
    ["Arrival", "arrival", 0, 0.05],
    ["Warm-up", "warmup", 0.05, 0.25],
    ["Build", "build", 0.25, 0.4],
    ["Peak", "peak", 0.4, 0.8],
    ["Release", "release", 0.8, 0.95],
    ["Savasana", "savasana", 0.95, 1],
  ]),
};

const FLEXIBILITY: ClassTypePreset = {
  type: "flexibility",
  label: "Flexibility Flow",
  description:
    "Calm opening, moderate build, less aggressive peak, extended down-regulation.",
  normalizedPoints: [
    { x: 0, energy: 10 },
    { x: 0.15, energy: 18 },
    { x: 0.35, energy: 38 },
    { x: 0.5, energy: 52 },
    { x: 0.65, energy: 44 },
    { x: 0.8, energy: 28 },
    { x: 0.92, energy: 14 },
    { x: 1, energy: 6 },
  ],
  normalizedPhases: phases([
    ["Arrival", "arrival", 0, 0.1],
    ["Warm-up", "warmup", 0.1, 0.3],
    ["Build", "build", 0.3, 0.5],
    ["Peak", "peak", 0.5, 0.65],
    ["Release", "release", 0.65, 0.9],
    ["Savasana", "savasana", 0.9, 1],
  ]),
};

const FOUNDATIONS: ClassTypePreset = {
  type: "foundations",
  label: "Yoga Foundations",
  description:
    "Grounded, moderate energy, limited dramatic peaks, clear phase changes, supportive non-distracting music.",
  normalizedPoints: [
    { x: 0, energy: 15 },
    { x: 0.15, energy: 22 },
    { x: 0.35, energy: 34 },
    { x: 0.5, energy: 40 },
    { x: 0.65, energy: 36 },
    { x: 0.8, energy: 26 },
    { x: 0.92, energy: 16 },
    { x: 1, energy: 10 },
  ],
  normalizedPhases: phases([
    ["Arrival", "arrival", 0, 0.1],
    ["Warm-up", "warmup", 0.1, 0.3],
    ["Build", "build", 0.3, 0.5],
    ["Peak", "peak", 0.5, 0.65],
    ["Release", "release", 0.65, 0.9],
    ["Savasana", "savasana", 0.9, 1],
  ]),
};

const CUSTOM: ClassTypePreset = {
  type: "custom",
  label: "Custom",
  description: "Start from an empty, neutral curve and shape your own arc.",
  normalizedPoints: [
    { x: 0, energy: 20 },
    { x: 0.5, energy: 35 },
    { x: 1, energy: 15 },
  ],
  normalizedPhases: phases([["Class", "custom", 0, 1]]),
};

export const CLASS_TYPE_PRESETS: Record<ClassType, ClassTypePreset> = {
  slow_flow: SLOW_FLOW,
  ashtanga: ASHTANGA,
  strength: STRENGTH,
  flexibility: FLEXIBILITY,
  foundations: FOUNDATIONS,
  custom: CUSTOM,
};

export const CLASS_TYPE_ORDER: ClassType[] = [
  "slow_flow",
  "ashtanga",
  "strength",
  "flexibility",
  "foundations",
  "custom",
];
