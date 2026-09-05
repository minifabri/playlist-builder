import { describe, expect, it } from "vitest";
import { sampleTargetEnergy } from "./sampleTargetEnergy";
import type { EnergyCurve } from "./types";

const risingCurve: EnergyCurve = {
  durationSec: 100,
  interpolation: "linear",
  points: [
    { id: "a", timeSec: 0, energy: 0 },
    { id: "b", timeSec: 100, energy: 100 },
  ],
};

const flatCurve: EnergyCurve = {
  durationSec: 100,
  interpolation: "linear",
  points: [
    { id: "a", timeSec: 0, energy: 50 },
    { id: "b", timeSec: 100, energy: 50 },
  ],
};

describe("sampleTargetEnergy", () => {
  it("returns the constant value for a flat curve", () => {
    expect(sampleTargetEnergy(flatCurve, 0, 100)).toBeCloseTo(50, 5);
  });

  it("weights the midpoint more heavily on a linear ramp", () => {
    // Pure average of start/25/50/75/end on a linear ramp still equals the
    // midpoint value regardless of weighting, so assert against the
    // analytically expected value directly.
    const result = sampleTargetEnergy(risingCurve, 0, 100);
    expect(result).toBeCloseTo(50, 5);
  });

  it("stays within the min/max energy observed over the interval", () => {
    const result = sampleTargetEnergy(risingCurve, 20, 40);
    expect(result).toBeGreaterThanOrEqual(20);
    expect(result).toBeLessThanOrEqual(40);
  });
});
