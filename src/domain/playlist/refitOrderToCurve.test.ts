import { describe, expect, it } from "vitest";
import { refitOrderToCurve } from "./refitOrderToCurve";
import type { DraftTrack } from "./types";
import type { EnergyCurve } from "@/domain/energy/types";

// A steady ramp from 0 to 100 over the whole class — later slots always
// call for more energy than earlier ones.
const rampCurve: EnergyCurve = {
  durationSec: 400,
  interpolation: "linear",
  points: [
    { id: "a", timeSec: 0, energy: 0 },
    { id: "b", timeSec: 400, energy: 100 },
  ],
};

function track(id: string, energyEstimate: number, locked = false): DraftTrack {
  return {
    id,
    source: "mock",
    title: id,
    artist: "Test",
    durationMs: 100_000, // 100s, so 4 tracks exactly fill the 400s curve
    energyEstimate,
    vocalsLevel: 50,
    locked,
  };
}

describe("refitOrderToCurve", () => {
  it("sorts unlocked tracks so their energy climbs with the ramp", () => {
    const order = [track("a", 90), track("b", 10), track("c", 70), track("d", 30)];
    const next = refitOrderToCurve(order, rampCurve);
    expect(next.map((t) => t.energyEstimate)).toEqual([10, 30, 70, 90]);
  });

  it("never moves a locked track, and never moves an unlocked track across it", () => {
    const order = [
      track("a", 50),
      track("b", 10),
      track("locked", 999, true),
      track("d", 90),
      track("e", 30),
    ];
    const next = refitOrderToCurve(order, rampCurve);

    // The locked track stays at the same index.
    expect(next[2].id).toBe("locked");
    // Each side of the lock is independently sorted ascending (the ramp
    // still rises within each side), and no track crosses the lock.
    expect(next.slice(0, 2).map((t) => t.energyEstimate)).toEqual([10, 50]);
    expect(next.slice(3, 5).map((t) => t.energyEstimate)).toEqual([30, 90]);
  });

  it("is a no-op for fewer than two tracks", () => {
    const order = [track("solo", 42)];
    expect(refitOrderToCurve(order, rampCurve)).toEqual(order);
  });

  it("leaves an all-locked draft unchanged", () => {
    const order = [track("a", 90, true), track("b", 10, true)];
    const next = refitOrderToCurve(order, rampCurve);
    expect(next.map((t) => t.id)).toEqual(["a", "b"]);
  });
});
