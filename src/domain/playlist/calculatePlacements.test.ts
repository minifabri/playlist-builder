import { describe, expect, it } from "vitest";
import { calculatePlacements, totalDurationMs } from "./calculatePlacements";
import { MOCK_TRACK_POOL } from "./mockTracks";
import type { EnergyCurve } from "@/domain/energy/types";

const flatCurve: EnergyCurve = {
  durationSec: 3600,
  interpolation: "linear",
  points: [
    { id: "a", timeSec: 0, energy: 40 },
    { id: "b", timeSec: 3600, energy: 40 },
  ],
};

describe("calculatePlacements", () => {
  it("places tracks back-to-back using cumulative duration", () => {
    const order = [
      { trackId: MOCK_TRACK_POOL[0].id, locked: false },
      { trackId: MOCK_TRACK_POOL[1].id, locked: true },
    ];
    const placements = calculatePlacements(order, flatCurve);

    expect(placements[0].startMs).toBe(0);
    expect(placements[0].endMs).toBe(MOCK_TRACK_POOL[0].durationMs);
    expect(placements[1].startMs).toBe(MOCK_TRACK_POOL[0].durationMs);
    expect(placements[1].endMs).toBe(
      MOCK_TRACK_POOL[0].durationMs + MOCK_TRACK_POOL[1].durationMs,
    );
    expect(placements[1].locked).toBe(true);
  });

  it("samples target energy close to the flat curve value", () => {
    const order = [{ trackId: MOCK_TRACK_POOL[0].id, locked: false }];
    const placements = calculatePlacements(order, flatCurve);
    expect(placements[0].targetEnergy).toBeCloseTo(40, 5);
  });

  it("recalculates placements after removing a track", () => {
    const before = [
      { trackId: MOCK_TRACK_POOL[0].id, locked: false },
      { trackId: MOCK_TRACK_POOL[1].id, locked: false },
      { trackId: MOCK_TRACK_POOL[2].id, locked: false },
    ];
    const after = before.slice(1); // remove the first track

    const placementsAfter = calculatePlacements(after, flatCurve);
    expect(placementsAfter[0].startMs).toBe(0);
  });
});

describe("totalDurationMs", () => {
  it("sums track durations", () => {
    const order = [
      { trackId: MOCK_TRACK_POOL[0].id, locked: false },
      { trackId: MOCK_TRACK_POOL[1].id, locked: false },
    ];
    expect(totalDurationMs(order)).toBe(
      MOCK_TRACK_POOL[0].durationMs + MOCK_TRACK_POOL[1].durationMs,
    );
  });
});
