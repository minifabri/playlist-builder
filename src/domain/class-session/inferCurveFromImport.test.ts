import { describe, expect, it } from "vitest";
import { inferCurveFromImport, type ImportTrackEnergyInput } from "./inferCurveFromImport";

function track(energy: number, durationMs = 200_000, estimated = true): ImportTrackEnergyInput {
  return { spotifyTrackId: `t-${Math.random()}`, durationMs, energy, estimated };
}

describe("inferCurveFromImport", () => {
  it("returns an empty curve for no tracks", () => {
    const curve = inferCurveFromImport([]);
    expect(curve.durationSec).toBe(0);
    expect(curve.points).toEqual([]);
  });

  it("pins first/last points to 0 and total duration for a single track", () => {
    const curve = inferCurveFromImport([track(60, 180_000)]);
    expect(curve.durationSec).toBe(180);
    expect(curve.points[0].timeSec).toBe(0);
    expect(curve.points[curve.points.length - 1].timeSec).toBe(180);
    expect(curve.points.every((p) => p.energy === 60)).toBe(true);
  });

  it("keeps one point per track boundary for <=8 tracks, without averaging", () => {
    const tracks = [track(10, 60_000), track(80, 60_000), track(20, 60_000)];
    const curve = inferCurveFromImport(tracks);

    // 3 boundaries (starts) + 1 pinned end point = 4 points.
    expect(curve.points).toHaveLength(4);
    expect(curve.points[0].timeSec).toBe(0);
    expect(curve.points[0].energy).toBe(10);
    expect(curve.points[1].timeSec).toBe(60);
    expect(curve.points[1].energy).toBe(80);
    expect(curve.points[2].timeSec).toBe(120);
    expect(curve.points[2].energy).toBe(20);
    expect(curve.points[3].timeSec).toBe(180);
    expect(curve.points[3].energy).toBe(20); // pinned end repeats the last track's value
  });

  it("flags points as estimated when the underlying track is estimated", () => {
    const tracks = [track(10, 60_000, true), track(80, 60_000, false)];
    const curve = inferCurveFromImport(tracks);
    expect(curve.points[0].estimated).toBe(true);
    expect(curve.points[1].estimated).toBe(false);
  });

  it("pins first/last points and stays within a legible point count when downsampling", () => {
    const tracks = Array.from({ length: 20 }, (_, i) => track(50 + (i % 5) * 5));
    const curve = inferCurveFromImport(tracks);

    expect(curve.points.length).toBeGreaterThanOrEqual(6);
    expect(curve.points.length).toBeLessThanOrEqual(10);
    expect(curve.points[0].timeSec).toBe(0);
    expect(curve.points[curve.points.length - 1].timeSec).toBe(curve.durationSec);
  });

  it("does not fabricate an artificial arc — a flat neutral playlist stays flat", () => {
    const tracks = Array.from({ length: 15 }, () => track(50));
    const curve = inferCurveFromImport(tracks);
    for (const p of curve.points) {
      expect(p.energy).toBeCloseTo(50, 5);
    }
  });

  it("produces strictly increasing point times (a valid curve)", () => {
    const tracks = Array.from({ length: 15 }, (_, i) => track(30 + i));
    const curve = inferCurveFromImport(tracks);
    for (let i = 1; i < curve.points.length; i++) {
      expect(curve.points[i].timeSec).toBeGreaterThan(curve.points[i - 1].timeSec);
    }
  });
});
