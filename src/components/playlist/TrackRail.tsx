"use client";

import { useState, type FormEvent } from "react";
import { energyLabel } from "@/domain/energy";
import type { EnergyCurve } from "@/domain/energy/types";
import {
  calculatePlacements,
  formatDurationDelta,
  totalDurationMs,
} from "@/domain/playlist/calculatePlacements";
import { MOCK_TRACK_POOL } from "@/domain/playlist/mockTracks";
import type { DraftTrack } from "@/domain/playlist/types";
import { Button } from "@/components/ui/Button";
import type { TrackSummary } from "@/integrations/spotify/types";

type Props = {
  order: DraftTrack[];
  curve: EnergyCurve;
  connected: boolean;
  onChange: (order: DraftTrack[]) => void;
};

function formatMs(ms: number): string {
  const totalSec = Math.round(ms / 1000);
  const m = Math.floor(totalSec / 60);
  const s = totalSec % 60;
  return `${m}:${String(s).padStart(2, "0")}`;
}

export function TrackRail({ order, curve, connected, onChange }: Props) {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<TrackSummary[]>([]);
  const [searching, setSearching] = useState(false);
  const [searchError, setSearchError] = useState<string | null>(null);

  const placements = calculatePlacements(order, curve);
  const totalMs = totalDurationMs(order);
  const durationFeedback = formatDurationDelta(totalMs, curve.durationSec);
  const availableMockTracks = MOCK_TRACK_POOL.filter(
    (t) => !order.some((o) => o.source === "mock" && o.id === t.id),
  );
  const exportableCount = order.filter((t) => t.source === "spotify").length;

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

  function addMockTrack(trackId: string) {
    const track = MOCK_TRACK_POOL.find((t) => t.id === trackId);
    if (!track) return;
    onChange([
      ...order,
      {
        id: track.id,
        source: "mock",
        title: track.title,
        artist: track.artist,
        durationMs: track.durationMs,
        energyEstimate: track.energyEstimate,
        vocalsLevel: track.vocalsLevel,
        locked: false,
      },
    ]);
  }

  function addSpotifyTrack(track: TrackSummary) {
    if (order.some((o) => o.source === "spotify" && o.id === track.id)) return;
    onChange([
      ...order,
      {
        id: track.id,
        source: "spotify",
        spotifyUri: track.uri,
        title: track.title,
        artist: track.artist,
        durationMs: track.durationMs,
        // No real audio-feature signal is available (Spotify Audio
        // Features are unavailable for new apps) — neutral default until a
        // future phase adds real profiling.
        energyEstimate: 50,
        vocalsLevel: 50,
        locked: false,
      },
    ]);
  }

  async function runSearch(e: FormEvent) {
    e.preventDefault();
    if (!query.trim()) return;
    setSearching(true);
    setSearchError(null);
    try {
      const res = await fetch(`/api/music/search/tracks?q=${encodeURIComponent(query)}`);
      const data = await res.json();
      if (!res.ok) {
        setSearchError(
          data.code === "RATE_LIMITED" || data.code === "QUOTA_EXCEEDED"
            ? "Spotify è temporaneamente occupato — riprova tra poco."
            : "Ricerca non riuscita. Riprova.",
        );
        setResults([]);
      } else {
        setResults(data.items ?? []);
      }
    } catch {
      setSearchError("Ricerca non riuscita. Controlla la connessione.");
    } finally {
      setSearching(false);
    }
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
        {placements.map((p, index) => {
          const track = order[index];
          const widthPct = (p.endMs - p.startMs) / Math.max(curve.durationSec * 1000, 1) * 100;
          return (
            <div
              key={`${p.trackId}-${index}`}
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
          const track = order[index];
          if (!track) return null;
          return (
            <li
              key={`${p.trackId}-${index}`}
              className="flex flex-wrap items-center gap-3 px-4 py-3 text-sm"
            >
              <div className="min-w-[10ch] text-text-muted text-xs tabular-nums">
                {formatMs(p.startMs)}
              </div>
              <div className="flex-1 min-w-[10rem]">
                <div className="font-medium text-text">
                  {track.title}
                  {track.source === "spotify" && (
                    <span
                      className="ml-1.5 rounded-full bg-sage-soft px-1.5 py-0.5 text-[9px] font-medium uppercase tracking-wide text-sage-strong align-middle"
                      title="Real Spotify track — exportable"
                    >
                      Spotify
                    </span>
                  )}
                </div>
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

      {order.length > 0 && (
        <p className="text-[11px] text-text-muted">
          {exportableCount} of {order.length} track{order.length === 1 ? "" : "s"} can be
          exported to Spotify (search below to add real tracks — sample tracks can&apos;t be
          exported).
        </p>
      )}

      {availableMockTracks.length > 0 && (
        <div className="flex items-center gap-2">
          <select
            defaultValue=""
            onChange={(e) => {
              addMockTrack(e.target.value);
              e.target.value = "";
            }}
            className="h-9 flex-1 rounded-[var(--radius-control)] border border-border bg-surface px-3 text-sm text-text"
            aria-label="Add a sample track"
          >
            <option value="" disabled>
              Add a sample track…
            </option>
            {availableMockTracks.map((t) => (
              <option key={t.id} value={t.id}>
                {t.title} — {t.artist} ({formatMs(t.durationMs)})
              </option>
            ))}
          </select>
        </div>
      )}

      <div className="rounded-[var(--radius-panel)] border border-border p-3">
        <h4 className="text-xs font-medium text-text">Search Spotify</h4>
        {!connected ? (
          <p className="mt-1 text-xs text-text-muted">
            Connect Spotify (in the panel on the right) to search real tracks.
          </p>
        ) : (
          <>
            <form onSubmit={runSearch} className="mt-2 flex gap-2">
              <input
                type="text"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Track or artist…"
                className="h-9 flex-1 rounded-[var(--radius-control)] border border-border bg-surface px-3 text-sm text-text"
                aria-label="Search Spotify tracks"
              />
              <Button type="submit" variant="secondary" size="sm" disabled={searching}>
                {searching ? "…" : "Search"}
              </Button>
            </form>
            {searchError && <p className="mt-2 text-xs text-danger">{searchError}</p>}
            {results.length > 0 && (
              <ul className="mt-2 max-h-56 space-y-1 overflow-y-auto">
                {results.map((t) => (
                  <li
                    key={t.id}
                    className="flex items-center justify-between gap-2 rounded-[var(--radius-control)] px-2 py-1.5 text-xs hover:bg-surface-subtle"
                  >
                    <span className="truncate">
                      <span className="font-medium text-text">{t.title}</span>{" "}
                      <span className="text-text-muted">
                        — {t.artist} ({formatMs(t.durationMs)})
                      </span>
                    </span>
                    <button
                      type="button"
                      onClick={() => addSpotifyTrack(t)}
                      className="shrink-0 rounded-full bg-primary px-2 py-1 text-[10px] font-medium text-white hover:opacity-90"
                    >
                      + Add
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </>
        )}
      </div>
    </div>
  );
}
