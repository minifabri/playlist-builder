import { describe, expect, it } from "vitest";
import { buildEnergyFunction } from "./interpolateEnergy";
import type { EnergyCurve } from "./types";

const linearCurve: EnergyCurve = {
  durationSec: 100,
  interpolation: "linear",
  points: [
    { id: "a", timeSec: 0, energy: 0 },
    { id: "b", timeSec: 50, energy: 100 },
    { id: "c", timeSec: 100, energy: 0 },
  ],
};

const monotoneCurve: EnergyCurve = {
  durationSec: 3600,
  interpolation: "monotone",
  points: [
    { id: "a", timeSec: 0, energy: 12 },
    { id: "b", timeSec: 600, energy: 20 },
    { id: "c", timeSec: 1440, energy: 48 },
    { id: "d", timeSec: 2040, energy: 66 },
    { id: "e", timeSec: 2520, energy: 58 },
    { id: "f", timeSec: 3000, energy: 32 },
    { id: "g", timeSec: 3360, energy: 16 },
    { id: "h", timeSec: 3600, energy: 8 },
  ],
};

describe("buildEnergyFunction (linear)", () => {
  it("returns exact values at control points", () => {
    const E = buildEnergyFunction(linearCurve);
    expect(E(0)).toBe(0);
    expect(E(50)).toBe(100);
    expect(E(100)).toBe(0);
  });

  it("interpolates linearly between points", () => {
    const E = buildEnergyFunction(linearCurve);
    expect(E(25)).toBeCloseTo(50, 5);
    expect(E(75)).toBeCloseTo(50, 5);
  });

  it("clamps outside the curve's time range", () => {
    const E = buildEnergyFunction(linearCurve);
    expect(E(-10)).toBe(0);
    expect(E(1000)).toBe(0);
  });
});

describe("buildEnergyFunction (monotone)", () => {
  it("returns exact values at control points", () => {
    const E = buildEnergyFunction(monotoneCurve);
    for (const p of monotoneCurve.points) {
      expect(E(p.timeSec)).toBeCloseTo(p.energy, 5);
    }
  });

  it("never leaves the 0..100 range, even between points", () => {
    const E = buildEnergyFunction(monotoneCurve);
    for (let t = 0; t <= monotoneCurve.durationSec; t += 5) {
      const value = E(t);
      expect(value).toBeGreaterThanOrEqual(0);
      expect(value).toBeLessThanOrEqual(100);
    }
  });

  it("does not overshoot a locally monotone segment", () => {
    // Between point b (600s, 20) and c (1440s, 48) the curve is rising;
    // sampled values along that segment must stay within [20, 48].
    const E = buildEnergyFunction(monotoneCurve);
    for (let t = 600; t <= 1440; t += 10) {
      const value = E(t);
      expect(value).toBeGreaterThanOrEqual(20 - 1e-6);
      expect(value).toBeLessThanOrEqual(48 + 1e-6);
    }
  });

  it("handles a single-point curve as a constant", () => {
    const E = buildEnergyFunction({
      durationSec: 100,
      interpolation: "monotone",
      points: [{ id: "a", timeSec: 0, energy: 42 }],
    });
    expect(E(0)).toBe(42);
    expect(E(99)).toBe(42);
  });
});
