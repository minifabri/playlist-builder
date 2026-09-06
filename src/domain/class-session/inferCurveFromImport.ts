import type { EnergyCurve, EnergyPoint } from "@/domain/energy/types";

/**
 * Curve inference input for one imported track, already reduced to a
 * resolved energy estimate (05_PLAYLIST_RESHAPE.md — "Curve inference
 * algorithm", step 1: teacher override if one exists, otherwise neutral
 * ~50 flagged `estimated`). Resolving that lookup is the caller's job
 * (createSessionFromImport) — this function only turns an already-resolved
 * per-track series into a curve, so it stays a pure, easily testable unit.
 */
export type ImportTrackEnergyInput = {
  spotifyTrackId: string;
  durationMs: number;
  energy: number; // 0..100
  estimated: boolean;
};

/** Playlists at or below this size keep one curve point per track boundary
 * instead of downsampling (05_PLAYLIST_RESHAPE.md — step 3). */
const KEEP_PER_TRACK_MAX = 8;

/** Target point count for downsampled curves — within the spec's 6–10
 * range regardless of track count. */
const TARGET_DOWNSAMPLE_POINTS = 8;

let idCounter = 0;
function nextPointId(): string {
  idCounter += 1;
  return `import-pt-${Date.now().toString(36)}-${idCounter}`;
}

function point(timeSec: number, energy: number, estimated: boolean): EnergyPoint {
  return { id: nextPointId(), timeSec, energy, estimated };
}

/**
 * Infer an EnergyCurve from an imported playlist's own tracks
 * (05_PLAYLIST_RESHAPE.md — "Curve inference algorithm"). Reflects only
 * the resolved per-track values — flat where data is neutral, no
 * artificial arc smoothing toward a preset shape. First/last points are
 * always pinned to t=0 and t=durationSec, per the editor's curve
 * invariants (04_ENERGY_CURVE_EDITOR.md).
 */
export function inferCurveFromImport(tracks: ImportTrackEnergyInput[]): EnergyCurve {
  if (tracks.length === 0) {
    return { durationSec: 0, interpolation: "monotone", points: [] };
  }

  const durationSec = Math.round(
    tracks.reduce((sum, t) => sum + t.durationMs, 0) / 1000,
  );

  const startsSec: number[] = [];
  let cursorSec = 0;
  for (const t of tracks) {
    startsSec.push(cursorSec);
    cursorSec += t.durationMs / 1000;
  }

  if (tracks.length === 1) {
    const only = tracks[0];
    return {
      durationSec,
      interpolation: "monotone",
      points: [
        point(0, only.energy, only.estimated),
        point(durationSec, only.energy, only.estimated),
      ],
    };
  }

  const points =
    tracks.length <= KEEP_PER_TRACK_MAX
      ? pointsPerTrackBoundary(tracks, startsSec, durationSec)
      : downsampleByMovingAverage(tracks, startsSec, durationSec);

  return { durationSec, interpolation: "monotone", points };
}

/** ≤8 tracks: one point per track boundary, no averaging. */
function pointsPerTrackBoundary(
  tracks: ImportTrackEnergyInput[],
  startsSec: number[],
  durationSec: number,
): EnergyPoint[] {
  const points = tracks.map((t, i) => point(startsSec[i], t.energy, t.estimated));
  const last = tracks[tracks.length - 1];
  points.push(point(durationSec, last.energy, last.estimated));
  // Guard the invariant even after any rounding above.
  points[0].timeSec = 0;
  points[points.length - 1].timeSec = durationSec;
  return points;
}

/** >8 tracks: moving-average downsample to a bounded, legible point count. */
function downsampleByMovingAverage(
  tracks: ImportTrackEnergyInput[],
  startsSec: number[],
  durationSec: number,
): EnergyPoint[] {
  const midpointsSec = tracks.map((t, i) => startsSec[i] + t.durationMs / 1000 / 2);
  const intervals = TARGET_DOWNSAMPLE_POINTS - 1;
  const windowWidthSec = durationSec / intervals;

  const points: EnergyPoint[] = [];
  for (let k = 0; k < TARGET_DOWNSAMPLE_POINTS; k++) {
    const targetSec = (k / intervals) * durationSec;
    const windowStart = Math.max(0, targetSec - windowWidthSec / 2);
    const windowEnd = Math.min(durationSec, targetSec + windowWidthSec / 2);

    const inWindow = tracks.filter(
      (_, i) => midpointsSec[i] >= windowStart && midpointsSec[i] <= windowEnd,
    );
    const contributing =
      inWindow.length > 0
        ? inWindow
        : // Sparse window (wide gap between neighboring tracks) — fall back
          // to the single nearest raw sample rather than leaving a gap.
          [
            tracks[
              midpointsSec.reduce(
                (bestIdx, m, i) =>
                  Math.abs(m - targetSec) < Math.abs(midpointsSec[bestIdx] - targetSec)
                    ? i
                    : bestIdx,
                0,
              )
            ],
          ];

    const totalDurationMs = contributing.reduce((sum, t) => sum + t.durationMs, 0);
    const energy =
      contributing.reduce((sum, t) => sum + t.energy * t.durationMs, 0) / totalDurationMs;
    const estimated = contributing.some((t) => t.estimated);

    points.push(point(targetSec, energy, estimated));
  }

  points[0].timeSec = 0;
  points[points.length - 1].timeSec = durationSec;
  return points;
}
