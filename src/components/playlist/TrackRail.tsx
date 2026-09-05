"use client";

import { useEffect, useRef, useState, type FormEvent } from "react";
import { energyLabel, sampleEnergyAt } from "@/domain/energy";
import type { EnergyCurve } from "@/domain/energy/types";
import {
  calculatePlacements,
  formatDurationDelta,
  totalDurationMs,
} from "@/domain/playlist/calculatePlacements";
import { MOCK_TRACK_POOL } from "@/domain/playlist/mockTracks";
import { pickMoodSuggestionSeed } from "@/domain/playlist/moodSuggestions";
import type { DraftTrack } from "@/domain/playlist/types";
import { Button } from "@/components/ui/Button";
import type { TrackSummary } from "@/integrations/spotify/types";

export type SearchSeed = { query: string; nonce: number };

type Props = {
  order: DraftTrack[];
  curve: EnergyCurve;
  connected: boolean;
  /** The listener's Spotify top genres, if connected — used to personalize
   * the "Suggested for you" pool. */
  topGenres?: string[];
  /** Set by the parent when a top artist/genre chip is clicked, to run a
   * search here without lifting the whole search UI up. */
  seed?: SearchSeed | null;
  onChange: (order: DraftTrack[]) => void;
};

const SUGGESTION_DEBOUNCE_MS = 500;

function formatMs(ms: number): string {
  const totalSec = Math.round(ms / 1000);
  const m = Math.floor(totalSec / 60);
  const s = totalSec % 60;
  return `${m}:${String(s).padStart(2, "0")}`;
}

/** Spotify's official embed player — no API token needed, works for any
 * listener (30s preview for free accounts, full playback for Premium).
 * This is the supported replacement now that track.preview_url is no
 * longer reliably returned by the Web API. */
function SpotifyPreviewEmbed({ trackId }: { trackId: string }) {
  return (
    <iframe
      title={`Spotify preview ${trackId}`}
      src={`https://open.spotify.com/embed/track/${trackId}?utm_source=generator`}
      width="100%"
      height="80"
      style={{ borderRadius: 12, border: 0 }}
      allow="autoplay; clipboard-write; encrypted-media; fullscreen; picture-in-picture"
      loading="lazy"
    />
  );
}

function TrackResultRow({
  track,
  isPreviewOpen,
  onTogglePreview,
  onAdd,
}: {
  track: TrackSummary;
  isPreviewOpen: boolean;
  onTogglePreview: () => void;
  onAdd: () => void;
}) {
  return (
    <li className="rounded-[var(--radius-control)] px-2 py-1.5 text-xs hover:bg-surface-subtle">
      <div className="flex items-center justify-between gap-2">
        <span className="truncate">
          <span className="font-medium text-text">{track.title}</span>{" "}
          <span className="text-text-muted">
            — {track.artist} ({formatMs(track.durationMs)})
          </span>
        </span>
        <span className="flex shrink-0 items-center gap-1">
          <button
            type="button"
            onClick={onTogglePreview}
            aria-pressed={isPreviewOpen}
            aria-label={isPreviewOpen ? "Hide preview" : "Preview track"}
            className={`h-6 w-6 rounded-full hover:bg-surface ${isPreviewOpen ? "text-primary" : "text-text-muted"}`}
          >
            {isPreviewOpen ? "◼" : "▶"}
          </button>
          <button
            type="button"
            onClick={onAdd}
            className="rounded-full bg-primary px-2 py-1 text-[10px] font-medium text-white hover:opacity-90"
          >
            + Add
          </button>
        </span>
      </div>
      {isPreviewOpen && (
        <div className="mt-1.5">
          <SpotifyPreviewEmbed trackId={track.id} />
        </div>
      )}
    </li>
  );
}

export function TrackRail({
  order,
  curve,
  connected,
  topGenres = [],
  seed,
  onChange,
}: Props) {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<TrackSummary[]>([]);
  const [searching, setSearching] = useState(false);
  const [searchError, setSearchError] = useState<string | null>(null);
  const [previewTrackId, setPreviewTrackId] = useState<string | null>(null);

  const [suggestions, setSuggestions] = useState<TrackSummary[]>([]);
  const [suggesting, setSuggesting] = useState(false);
  const [suggestionError, setSuggestionError] = useState<string | null>(null);
  const [suggestGenre, setSuggestGenre] = useState<string | null>(null);
  const [suggestRotation, setSuggestRotation] = useState(0);
  const suggestTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const placements = calculatePlacements(order, curve);
  const totalMs = totalDurationMs(order);
  const durationFeedback = formatDurationDelta(totalMs, curve.durationSec);
  const availableMockTracks = MOCK_TRACK_POOL.filter(
    (t) => !order.some((o) => o.source === "mock" && o.id === t.id),
  );
  const exportableCount = order.filter((t) => t.source === "spotify").length;

  // Where the next track would land, and what mood the class arc calls
  // for there — this is what drives "Suggested for you" below.
  const nextStartSec = totalMs / 1000;
  const draftIsFull = curve.durationSec > 0 && nextStartSec >= curve.durationSec;
  const nextTargetEnergy = sampleEnergyAt(curve, Math.min(nextStartSec, curve.durationSec));
  const nextMoodLabel = energyLabel(nextTargetEnergy);
  const topGenresKey = topGenres.join("|");

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

  async function performSearch(searchQuery: string) {
    if (!searchQuery.trim()) return;
    setSearching(true);
    setSearchError(null);
    try {
      const res = await fetch(
        `/api/music/search/tracks?q=${encodeURIComponent(searchQuery)}`,
      );
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

  function runSearch(e: FormEvent) {
    e.preventDefault();
    performSearch(query);
  }

  // Runs a search when a top artist/genre chip is clicked in the parent
  // panel. The nonce lets the same chip be clicked twice in a row.
  useEffect(() => {
    if (!seed) return;
    // Syncing the search box to a signal from the parent (an artist/genre
    // chip click) — the sanctioned "respond to an external trigger"
    // useEffect pattern, gated on seed.nonce so re-clicking the same chip
    // still re-runs the search.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setQuery(seed.query);
    performSearch(seed.query);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [seed?.nonce]);

  // "Suggested for you": re-fetches from Spotify search whenever the mood
  // at the next open slot changes (nextMoodLabel only takes 5 discrete
  // values, so dragging a curve point doesn't spam Spotify — it re-fetches
  // only when a mood *band* boundary is crossed), the listener's top
  // genres load, or "shuffle" is clicked. Debounced defensively on top of
  // that quantization.
  useEffect(() => {
    if (suggestTimer.current) clearTimeout(suggestTimer.current);
    if (!connected || draftIsFull) {
      // Clearing suggestions in response to an external-trigger change
      // (connection dropped / draft became full) — same sanctioned pattern
      // as the seed-driven search effect above.
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setSuggestions([]);
      setSuggestGenre(null);
      return;
    }
    suggestTimer.current = setTimeout(async () => {
      setSuggesting(true);
      setSuggestionError(null);
      const seedPick = pickMoodSuggestionSeed(nextTargetEnergy, topGenres, suggestRotation);
      setSuggestGenre(seedPick.genre);
      try {
        const res = await fetch(
          `/api/music/search/tracks?q=${encodeURIComponent(`genre:"${seedPick.genre}"`)}`,
        );
        const data = await res.json();
        if (!res.ok) {
          setSuggestionError(
            data.code === "RATE_LIMITED" || data.code === "QUOTA_EXCEEDED"
              ? "Spotify è temporaneamente occupato — riprova tra poco."
              : "Suggerimenti non disponibili al momento.",
          );
          setSuggestions([]);
        } else {
          setSuggestions((data.items ?? []).slice(0, 6));
        }
      } catch {
        setSuggestionError("Suggerimenti non disponibili al momento.");
      } finally {
        setSuggesting(false);
      }
    }, SUGGESTION_DEBOUNCE_MS);
    return () => {
      if (suggestTimer.current) clearTimeout(suggestTimer.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [connected, nextMoodLabel, topGenresKey, suggestRotation, draftIsFull]);

  function togglePreview(trackId: string) {
    setPreviewTrackId((current) => (current === trackId ? null : trackId));
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
          const isPreviewOpen = previewTrackId === track.id;
          return (
            <li key={`${p.trackId}-${index}`} className="px-4 py-3 text-sm">
              <div className="flex flex-wrap items-center gap-3">
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
                  {track.source === "spotify" && (
                    <button
                      type="button"
                      onClick={() => togglePreview(track.id)}
                      aria-pressed={isPreviewOpen}
                      aria-label={isPreviewOpen ? "Hide preview" : "Preview track"}
                      className={`h-8 w-8 rounded-[var(--radius-control)] hover:bg-surface-subtle ${isPreviewOpen ? "text-primary" : "text-text-muted"}`}
                    >
                      {isPreviewOpen ? "◼" : "▶"}
                    </button>
                  )}
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
              </div>
              {isPreviewOpen && (
                <div className="mt-2">
                  <SpotifyPreviewEmbed trackId={track.id} />
                </div>
              )}
            </li>
          );
        })}
      </ul>

      {order.length > 0 && (
        <p className="text-[11px] text-text-muted">
          {exportableCount} of {order.length} track{order.length === 1 ? "" : "s"} can be
          exported to Spotify. Sample tracks are a small built-in demo pool used to test
          the energy fit — they are not related to your Spotify taste and can&apos;t be
          exported; use the suggestions or search below to add real tracks instead.
        </p>
      )}

      <div className="rounded-[var(--radius-panel)] border border-border p-3">
        <div className="flex items-center justify-between">
          <h4 className="text-xs font-medium text-text">
            {draftIsFull
              ? "Suggested for you"
              : `Suggested for you — ${nextMoodLabel.toLowerCase()} · around minute ${Math.round(nextStartSec / 60)}`}
          </h4>
          {connected && !draftIsFull && (
            <button
              type="button"
              onClick={() => setSuggestRotation((r) => r + 1)}
              className="text-[11px] text-text-muted hover:text-text"
              title="Show different suggestions for this mood"
            >
              🔄 Shuffle
            </button>
          )}
        </div>
        {!connected ? (
          <p className="mt-1 text-xs text-text-muted">
            Connect Spotify to get track suggestions matched to your taste and to the
            mood at this point in the class.
          </p>
        ) : draftIsFull ? (
          <p className="mt-1 text-xs text-text-muted">
            The draft already fills the class length — remove or shorten something to
            get more suggestions.
          </p>
        ) : (
          <>
            <p className="mt-1 text-[11px] text-text-muted">
              Based on your Spotify taste and the energy arc at this point
              {suggestGenre ? ` — genre: ${suggestGenre}` : ""}. This is a heuristic
              (Spotify doesn&apos;t expose real audio-mood data for new apps), so tap 🔄
              if these don&apos;t feel right.
            </p>
            {suggesting && <p className="mt-2 text-xs text-text-muted">Loading…</p>}
            {suggestionError && (
              <p className="mt-2 text-xs text-danger">{suggestionError}</p>
            )}
            {!suggesting && suggestions.length > 0 && (
              <ul className="mt-2 space-y-1">
                {suggestions.map((t) => (
                  <TrackResultRow
                    key={t.id}
                    track={t}
                    isPreviewOpen={previewTrackId === t.id}
                    onTogglePreview={() => togglePreview(t.id)}
                    onAdd={() => addSpotifyTrack(t)}
                  />
                ))}
              </ul>
            )}
          </>
        )}
      </div>

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
              Add a sample track (demo only, not your taste)…
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
              <ul className="mt-2 max-h-72 space-y-1 overflow-y-auto">
                {results.map((t) => (
                  <TrackResultRow
                    key={t.id}
                    track={t}
                    isPreviewOpen={previewTrackId === t.id}
                    onTogglePreview={() => togglePreview(t.id)}
                    onAdd={() => addSpotifyTrack(t)}
                  />
                ))}
              </ul>
            )}
          </>
        )}
      </div>
    </div>
  );
}
