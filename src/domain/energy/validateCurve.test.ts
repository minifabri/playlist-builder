import { describe, expect, it } from "vitest";
import { validateCurve } from "./validateCurve";
import type { EnergyCurve } from "./types";

function curve(points: EnergyCurve["points"], durationSec = 3600): EnergyCurve {
  return { durationSec, points, interpolation: "monotone" };
}

describe("validateCurve", () => {
  it("accepts a well-formed curve", () => {
    const result = validateCurve(
      curve(
        [
          { id: "a", timeSec: 0, energy: 10 },
          { id: "b", timeSec: 1800, energy: 60 },
          { id: "c", timeSec: 3600, energy: 5 },
        ],
        3600,
      ),
    );
    expect(result.valid).toBe(true);
  });

  it("rejects an empty curve", () => {
    const result = validateCurve(curve([], 3600));
    expect(result.valid).toBe(false);
    if (!result.valid) {
      expect(result.errors.some((e) => e.code === "EMPTY_CURVE")).toBe(true);
    }
  });

  it("rejects a non-positive duration", () => {
    const result = validateCurve(
      curve([{ id: "a", timeSec: 0, energy: 10 }], 0),
    );
    expect(result.valid).toBe(false);
    if (!result.valid) {
      expect(
        result.errors.some((e) => e.code === "NON_POSITIVE_DURATION"),
      ).toBe(true);
    }
  });

  it("rejects a first point not at time 0", () => {
    const result = validateCurve(
      curve(
        [
          { id: "a", timeSec: 10, energy: 10 },
          { id: "b", timeSec: 3600, energy: 20 },
        ],
        3600,
      ),
    );
    expect(result.valid).toBe(false);
    if (!result.valid) {
      expect(
        result.errors.some((e) => e.code === "FIRST_POINT_NOT_AT_ZERO"),
      ).toBe(true);
    }
  });

  it("rejects a last point not at the duration", () => {
    const result = validateCurve(
      curve(
        [
          { id: "a", timeSec: 0, energy: 10 },
          { id: "b", timeSec: 3000, energy: 20 },
        ],
        3600,
      ),
    );
    expect(result.valid).toBe(false);
    if (!result.valid) {
      expect(
        result.errors.some((e) => e.code === "LAST_POINT_NOT_AT_DURATION"),
      ).toBe(true);
    }
  });

  it("rejects energy out of 0..100 range", () => {
    const result = validateCurve(
      curve(
        [
          { id: "a", timeSec: 0, energy: -5 },
          { id: "b", timeSec: 3600, energy: 120 },
        ],
        3600,
      ),
    );
    expect(result.valid).toBe(false);
    if (!result.valid) {
      const codes = result.errors.map((e) => e.code);
      expect(codes.filter((c) => c === "ENERGY_OUT_OF_RANGE")).toHaveLength(2);
    }
  });

  it("rejects non-increasing timestamps", () => {
    const result = validateCurve(
      curve(
        [
          { id: "a", timeSec: 0, energy: 10 },
          { id: "b", timeSec: 100, energy: 20 },
          { id: "c", timeSec: 50, energy: 30 },
          { id: "d", timeSec: 3600, energy: 5 },
        ],
        3600,
      ),
    );
    expect(result.valid).toBe(false);
    if (!result.valid) {
      expect(result.errors.some((e) => e.code === "TIME_NOT_INCREASING")).toBe(
        true,
      );
    }
  });

  it("rejects points closer than the minimum gap", () => {
    const result = validateCurve(
      curve(
        [
          { id: "a", timeSec: 0, energy: 10 },
          { id: "b", timeSec: 2, energy: 20 },
          { id: "c", timeSec: 3600, energy: 5 },
        ],
        3600,
      ),
    );
    expect(result.valid).toBe(false);
    if (!result.valid) {
      expect(result.errors.some((e) => e.code === "POINTS_TOO_CLOSE")).toBe(
        true,
      );
    }
  });
});
