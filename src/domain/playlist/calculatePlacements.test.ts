import { describe, expect, it } from "vitest";
import { calculatePlacements, totalDurationMs } from "./calculatePlacements";
import { MOCK_TRACK_POOL } from "./mockTracks";
import type { DraftTrack } from "./types";
import type { EnergyCurve } from "@/domain/energy/types";

const flatCurve: EnergyCurve = {
  durationSec: 3600,
  interpolation: "linear",
  points: [
    { id: "a", timeSec: 0, energy: 40 },
    { id: "b", timeSec: 3600, energy: 40 },
  ],
};

function draftFromMock(index: number, locked = false): DraftTrack {
  const t = MOCK_TRACK_POOL[index];
  return {
    id: t.id,
    source: "mock",
    title: t.title,
    artist: t.artist,
    durationMs: t.durationMs,
    energyEstimate: t.energyEstimate,
    vocalsLevel: t.vocalsLevel,
    locked,
  };
}

describe("calculatePlacements", () => {
  it("places tracks back-to-back using cumulative duration", () => {
    const order = [draftFromMock(0), draftFromMock(1, true)];
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
    const order = [draftFromMock(0)];
    const placements = calculatePlacements(order, flatCurve);
    expect(placements[0].targetEnergy).toBeCloseTo(40, 5);
  });

  it("recalculates placements after removing a track", () => {
    const before = [draftFromMock(0), draftFromMock(1), draftFromMock(2)];
    const after = before.slice(1); // remove the first track

    const placementsAfter = calculatePlacements(after, flatCurve);
    expect(placementsAfter[0].startMs).toBe(0);
  });

  it("includes Spotify-sourced tracks alongside mock ones", () => {
    const spotifyTrack: DraftTrack = {
      id: "5xyz",
      source: "spotify",
      spotifyUri: "spotify:track:5xyz",
      title: "Real Song",
      artist: "Real Artist",
      durationMs: 200_000,
      energyEstimate: 50,
      vocalsLevel: 50,
      locked: false,
    };
    const order = [draftFromMock(0), spotifyTrack];
    const placements = calculatePlacements(order, flatCurve);
    expect(placements[1].trackId).toBe("5xyz");
    expect(placements[1].startMs).toBe(MOCK_TRACK_POOL[0].durationMs);
  });
});

describe("totalDurationMs", () => {
  it("sums track durations", () => {
    const order = [draftFromMock(0), draftFromMock(1)];
    expect(totalDurationMs(order)).toBe(
      MOCK_TRACK_POOL[0].durationMs + MOCK_TRACK_POOL[1].durationMs,
    );
  });
});
