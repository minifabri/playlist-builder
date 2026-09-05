"use client";

import { useMemo } from "react";
import { energyLabel } from "@/domain/energy";
import type { EnergyCurve } from "@/domain/energy/types";
import {
  calculatePlacements,
  formatDurationDelta,
  totalDurationMs,
  type OrderedTrack,
} from "@/domain/playlist/calculatePlacements";
import { MOCK_TRACK_POOL } from "@/domain/playlist/mockTracks";
import { Button } from "@/components/ui/Button";

type Props = {
  order: OrderedTrack[];
  curve: EnergyCurve;
  onChange: (order: OrderedTrack[]) => void;
};

function formatMs(ms: number): string {
  const totalSec = Math.round(ms / 1000);
  const m = Math.floor(totalSec / 60);
  const s = totalSec % 60;
  return `${m}:${String(s).padStart(2, "0")}`;
}

function trackById(id: string) {
  return MOCK_TRACK_POOL.find((t) => t.id === id);
}

export function TrackRail({ order, curve, onChange }: Props) {
  const placements = useMemo(
    () => calculatePlacements(order, curve),
    [order, curve],
  );
  const totalMs = totalDurationMs(order);
  const durationFeedback = formatDurationDelta(totalMs, curve.durationSec);
  const availableTracks = MOCK_TRACK_POOL.filter(
    (t) => !order.some((o) => o.trackId === t.id),
  );

  function move(index: number, direction: -1 | 1) {
    const target = index + direction;
    if (target < 0 || target >= order.length) return;
    const next = [...order];
    [next[index], next[target]] = [next[target], next[index]];
    onChange(next);
  }

  function toggleLock(index: number) {
    const next = order.map((entry, i) =>
      i === index ? { ...entry, locked: !entry.locked } : entry,
    );
    onChange(next);
  }

  function remove(index: number) {
    onChange(order.filter((_, i) => i !== index));
  }

  function addTrack(trackId: string) {
    if (!trackId) return;
    onChange([...order, { trackId, locked: false }]);
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-medium text-text">Playlist draft</h3>
        <span
          className={`rounded-full px-2.5 py-1 text-[11px] font-medium ${
            durationFeedback.status === "ok"
              ? "bg-sage-soft text-sage-strong"
              : "bg-warning/15 text-warning"
          }`}
        >
          {formatMs(totalMs)} total · {durationFeedback.label}
        </span>
      </div>

      {/* Proportional rail aligned to class time */}
      <div className="flex h-8 w-full overflow-hidden rounded-[var(--radius-control)] border border-border">
        {placements.length === 0 && (
          <div className="flex flex-1 items-center justify-center text-[11px] text-text-muted">
            No tracks yet
          </div>
        )}
        {placements.map((p) => {
          const track = trackById(p.trackId);
          const widthPct = (p.endMs - p.startMs) / Math.max(curve.durationSec * 1000, 1) * 100;
          return (
            <div
              key={p.trackId}
              style={{ width: `${widthPct}%` }}
              title={track?.title}
              className={`flex items-center justify-center border-r border-background/40 text-[10px] text-white truncate ${
                p.locked ? "bg-gold" : "bg-primary"
              }`}
            >
              {p.locked ? "🔒" : ""}
            </div>
          );
        })}
      </div>

      <ul className="divide-y divide-border rounded-[var(--radius-card)] border border-border bg-surface">
        {placements.map((p, index) => {
          const track = trackById(p.trackId);
          if (!track) return null;
          return (
            <li
              key={p.trackId}
              className="flex flex-wrap items-center gap-3 px-4 py-3 text-sm"
            >
              <div className="min-w-[10ch] text-text-muted text-xs tabular-nums">
                {formatMs(p.startMs)}
              </div>
              <div className="flex-1 min-w-[10rem]">
                <div className="font-medium text-text">{track.title}</div>
                <div className="text-xs text-text-muted">{track.artist}</div>
              </div>
              <div className="text-xs text-text-muted min-w-[6ch] tabular-nums">
                {formatMs(track.durationMs)}
              </div>
              <div className="text-xs text-text-muted min-w-[9rem]">
                target {Math.round(p.targetEnergy)} · fits {energyLabel(p.targetEnergy)}
              </div>
              <div className="flex items-center gap-1">
                <button
                  type="button"
                  onClick={() => move(index, -1)}
                  disabled={index === 0}
                  aria-label="Move earlier"
                  className="h-8 w-8 rounded-[var(--radius-control)] text-text-muted hover:bg-surface-subtle disabled:opacity-30"
                >
                  ↑
                </button>
                <button
                  type="button"
                  onClick={() => move(index, 1)}
                  disabled={index === placements.length - 1}
                  aria-label="Move later"
                  className="h-8 w-8 rounded-[var(--radius-control)] text-text-muted hover:bg-surface-subtle disabled:opacity-30"
                >
                  ↓
                </button>
                <button
                  type="button"
                  onClick={() => toggleLock(index)}
                  aria-pressed={p.locked}
                  aria-label={p.locked ? "Unlock track" : "Lock track"}
                  className={`h-8 w-8 rounded-[var(--radius-control)] hover:bg-surface-subtle ${p.locked ? "text-gold" : "text-text-muted"}`}
                >
                  {p.locked ? "🔒" : "🔓"}
                </button>
                <button
                  type="button"
                  onClick={() => remove(index)}
                  aria-label="Remove track"
                  className="h-8 w-8 rounded-[var(--radius-control)] text-danger hover:bg-danger/10"
                >
                  ✕
                </button>
              </div>
            </li>
          );
        })}
      </ul>

      {availableTracks.length > 0 && (
        <div className="flex items-center gap-2">
          <select
            defaultValue=""
            onChange={(e) => {
              addTrack(e.target.value);
              e.target.value = "";
            }}
            className="h-9 flex-1 rounded-[var(--radius-control)] border border-border bg-surface px-3 text-sm text-text"
            aria-label="Add a track"
          >
            <option value="" disabled>
              Add a track…
            </option>
            {availableTracks.map((t) => (
              <option key={t.id} value={t.id}>
                {t.title} — {t.artist} ({formatMs(t.durationMs)})
              </option>
            ))}
          </select>
          {order.length === 0 && (
            <Button
              type="button"
              variant="secondary"
              size="sm"
              onClick={() => onChange(availableTracks.map((t) => ({ trackId: t.id, locked: false })))}
            >
              Add all
            </Button>
          )}
        </div>
      )}
    </div>
  );
}
