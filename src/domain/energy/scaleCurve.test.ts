import { describe, expect, it } from "vitest";
import {
  applyCurveToDuration,
  normalizeCurve,
  scaleCurveToDuration,
} from "./scaleCurve";
import type { EnergyCurve } from "./types";

const slowFlow60: EnergyCurve = {
  durationSec: 3600,
  interpolation: "monotone",
  points: [
    { id: "a", timeSec: 0, energy: 12 },
    { id: "b", timeSec: 1440, energy: 48 },
    { id: "c", timeSec: 3600, energy: 8 },
  ],
};

describe("normalizeCurve", () => {
  it("normalizes point times to 0..1", () => {
    const normalized = normalizeCurve(slowFlow60);
    expect(normalized[0].x).toBe(0);
    expect(normalized[1].x).toBeCloseTo(0.4, 5);
    expect(normalized[2].x).toBe(1);
  });
});

describe("scaleCurveToDuration", () => {
  it("preserves the normalized shape and energies when scaling 60 -> 75 min", () => {
    const scaled = scaleCurveToDuration(slowFlow60, 75 * 60);

    expect(scaled.durationSec).toBe(4500);
    expect(scaled.points[0].timeSec).toBe(0);
    expect(scaled.points[scaled.points.length - 1].timeSec).toBe(4500);
    expect(scaled.points[1].timeSec).toBe(1800); // 0.4 * 4500
    expect(scaled.points.map((p) => p.energy)).toEqual([12, 48, 8]);
  });

  it("keeps first/last points pinned to the edges after rounding", () => {
    const scaled = applyCurveToDuration(
      [
        { x: 0, energy: 10 },
        { x: 0.3333333, energy: 50 },
        { x: 1, energy: 5 },
      ],
      70,
    );
    expect(scaled.points[0].timeSec).toBe(0);
    expect(scaled.points[scaled.points.length - 1].timeSec).toBe(70);
  });
});
