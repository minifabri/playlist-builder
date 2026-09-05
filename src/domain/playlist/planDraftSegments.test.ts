import { describe, expect, it } from "vitest";
import { planDraftSegments } from "./planDraftSegments";
import type { DraftTrack } from "./types";
import type { EnergyCurve } from "@/domain/energy/types";

const curve: EnergyCurve = {
  durationSec: 600,
  interpolation: "linear",
  points: [
    { id: "a", timeSec: 0, energy: 20 },
    { id: "b", timeSec: 600, energy: 80 },
  ],
};

function track(id: string, durationMs: number, locked = false): DraftTrack {
  return {
    id,
    source: "mock",
    title: id,
    artist: "Test",
    durationMs,
    energyEstimate: 50,
    vocalsLevel: 50,
    locked,
  };
}

describe("planDraftSegments", () => {
  it("returns one full-length gap for an empty draft", () => {
    const segments = planDraftSegments([], curve);
    expect(segments).toEqual([{ type: "gap", startSec: 0, endSec: 600 }]);
  });

  it("collapses any number of unlocked tracks into a single gap", () => {
    const order = [track("a", 100_000), track("b", 100_000), track("c", 100_000)];
    const segments = planDraftSegments(order, curve);
    expect(segments).toEqual([{ type: "gap", startSec: 0, endSec: 600 }]);
  });

  it("keeps a locked track and wraps it with gaps on both sides", () => {
    const order = [track("a", 100_000), track("locked", 100_000, true), track("c", 100_000)];
    const segments = planDraftSegments(order, curve);
    expect(segments).toEqual([
      { type: "gap", startSec: 0, endSec: 100 },
      { type: "locked", track: order[1] },
      { type: "gap", startSec: 200, endSec: 600 },
    ]);
  });

  it("emits no gap between two adjacent locked tracks", () => {
    const order = [track("locked1", 100_000, true), track("locked2", 100_000, true)];
    const segments = planDraftSegments(order, curve);
    expect(segments).toEqual([
      { type: "locked", track: order[0] },
      { type: "locked", track: order[1] },
      { type: "gap", startSec: 200, endSec: 600 },
    ]);
  });

  it("emits no trailing gap when locked tracks already fill (or exceed) the class length", () => {
    const order = [track("locked", 700_000, true)];
    const segments = planDraftSegments(order, curve);
    expect(segments).toEqual([{ type: "locked", track: order[0] }]);
  });
});
