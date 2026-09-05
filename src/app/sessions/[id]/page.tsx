"use client";

import { use, useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Button } from "@/components/ui/Button";
import { ThemeToggle } from "@/components/theme/ThemeToggle";
import { EnergyCurveEditor } from "@/components/energy-editor/EnergyCurveEditor";
import { TrackRail, type SearchSeed } from "@/components/playlist/TrackRail";
import { CLASS_TYPE_PRESETS } from "@/domain/class-session/presets";
import { localClassSessionRepository } from "@/domain/class-session/repository";
import type { ClassSession } from "@/domain/class-session/types";
import type { EnergyCurve } from "@/domain/energy/types";
import { scaleCurveToDuration, applyPhasesToDuration, normalizePhases } from "@/domain/energy/scaleCurve";
import { validateCurve } from "@/domain/energy/validateCurve";
import { energyLabelMidpoint, sampleEnergyAt } from "@/domain/energy";
import type { DraftTrack } from "@/domain/playlist/types";
import { planDraftSegments } from "@/domain/playlist/planDraftSegments";
import {
  ALL_YOGA_GENRES,
  buildSuggestionSearchQuery,
  pickMoodSuggestionSeed,
  rankByFamiliarity,
} from "@/domain/playlist/moodSuggestions";
import type { ArtistSummary, TrackSummary } from "@/integrations/spotify/types";

const AUTOSAVE_DELAY_MS = 700;

type ExportState =
  | { status: "idle" }
  | { status: "exporting" }
  | { status: "done"; playlistUrl: string }
  | { status: "error"; message: string };

type GenerateState =
  | { status: "idle" }
  | { status: "generating"; added: number }
  | { status: "done"; added: number }
  | { status: "error"; added: number; message: string };

const GENERATE_MIN_LEFTOVER_SEC = 45;
const GENERATE_MAX_ATTEMPTS_PER_SLOT = 4;
const GENERATE_MAX_PER_ARTIST = 2;

export default function SessionEditorPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  const router = useRouter();
  const searchParams = useSearchParams();
  const [session, setSession] = useState<ClassSession | null | undefined>(
    undefined,
  );
  const [order, setOrder] = useState<DraftTrack[]>([]);
  const [savedState, setSavedState] = useState<"saved" | "saving">("saved");
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const [spotifyConnected, setSpotifyConnected] = useState(false);
  const [spotifyDisplayName, setSpotifyDisplayName] = useState<string | null>(null);
  const [spotifyBanner, setSpotifyBanner] = useState<string | null>(null);
  const [topArtists, setTopArtists] = useState<ArtistSummary[]>([]);
  const [isPublicExport, setIsPublicExport] = useState(false);
  const [exportState, setExportState] = useState<ExportState>({ status: "idle" });
  const [searchSeed, setSearchSeed] = useState<SearchSeed | null>(null);
  const [preferredGenres, setPreferredGenres] = useState<string[]>([]);
  const [excludedGenres, setExcludedGenres] = useState<string[]>([]);
  const [discoveredArtists, setDiscoveredArtists] = useState<ArtistSummary[]>([]);
  const [discoveringArtists, setDiscoveringArtists] = useState(false);
  const [discoverArtistsError, setDiscoverArtistsError] = useState<string | null>(null);
  const [generateState, setGenerateState] = useState<GenerateState>({ status: "idle" });

  useEffect(() => {
    const found = localClassSessionRepository.get(id);
    // Reading localStorage (an external system) once after mount.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setSession(found ?? null);

    if (typeof window !== "undefined") {
      try {
        const raw = window.localStorage.getItem(`ima-yoga-tracks-${id}`);
        if (raw) setOrder(JSON.parse(raw) as DraftTrack[]);
      } catch {
        // ignore
      }
      try {
        const rawGenres = window.localStorage.getItem(`ima-yoga-genre-prefs-${id}`);
        if (rawGenres) {
          const parsed = JSON.parse(rawGenres) as {
            preferredGenres?: string[];
            excludedGenres?: string[];
          };
          setPreferredGenres(parsed.preferredGenres ?? []);
          setExcludedGenres(parsed.excludedGenres ?? []);
        }
      } catch {
        // ignore
      }
    }
  }, [id]);

  function saveGenrePrefs(nextPreferred: string[], nextExcluded: string[]) {
    if (typeof window === "undefined") return;
    try {
      window.localStorage.setItem(
        `ima-yoga-genre-prefs-${id}`,
        JSON.stringify({ preferredGenres: nextPreferred, excludedGenres: nextExcluded }),
      );
    } catch {
      // ignore
    }
  }

  function togglePreferredGenre(genre: string) {
    const nextPreferred = preferredGenres.includes(genre)
      ? preferredGenres.filter((g) => g !== genre)
      : [...preferredGenres, genre];
    const nextExcluded = excludedGenres.filter((g) => g !== genre);
    setPreferredGenres(nextPreferred);
    setExcludedGenres(nextExcluded);
    saveGenrePrefs(nextPreferred, nextExcluded);
    // The "show more artists" results were fetched for the old genre
    // selection — clear them rather than leave stale suggestions up.
    setDiscoveredArtists([]);
    setDiscoverArtistsError(null);
  }

  function toggleExcludedGenre(genre: string) {
    const nextExcluded = excludedGenres.includes(genre)
      ? excludedGenres.filter((g) => g !== genre)
      : [...excludedGenres, genre];
    const nextPreferred = preferredGenres.filter((g) => g !== genre);
    setExcludedGenres(nextExcluded);
    setPreferredGenres(nextPreferred);
    saveGenrePrefs(nextPreferred, nextExcluded);
  }

  // Reflect the ?spotify=connected|error redirect from the OAuth callback,
  // then strip it from the URL so a refresh doesn't re-show the banner.
  useEffect(() => {
    const spotifyResult = searchParams.get("spotify");
    if (!spotifyResult) return;
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setSpotifyBanner(
      spotifyResult === "connected"
        ? "Spotify connesso."
        : "Connessione a Spotify non riuscita. Riprova.",
    );
    router.replace(`/sessions/${id}`);
  }, [searchParams, router, id]);

  const refreshSpotifyStatus = useCallback(async () => {
    try {
      const res = await fetch("/api/music/status");
      const data = await res.json();
      setSpotifyConnected(Boolean(data.connected));
      setSpotifyDisplayName(typeof data.displayName === "string" ? data.displayName : null);
    } catch {
      setSpotifyConnected(false);
      setSpotifyDisplayName(null);
    }
  }, []);

  useEffect(() => {
    // Checking connection status against our own API is reading an
    // external system (the Spotify session cookie, via the server) — the
    // sanctioned useEffect pattern, not a value derivable from props/state.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    refreshSpotifyStatus();
  }, [refreshSpotifyStatus]);

  useEffect(() => {
    if (!spotifyConnected) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setTopArtists([]);
      return;
    }
    let cancelled = false;
    fetch("/api/music/top-artists")
      .then((res) => (res.ok ? res.json() : []))
      .then((items: ArtistSummary[]) => {
        if (!cancelled) setTopArtists(Array.isArray(items) ? items : []);
      })
      .catch(() => {
        if (!cancelled) setTopArtists([]);
      });
    return () => {
      cancelled = true;
    };
  }, [spotifyConnected]);

  async function disconnectSpotify() {
    await fetch("/api/spotify/disconnect", { method: "POST" });
    setSpotifyConnected(false);
    setSpotifyDisplayName(null);
    setTopArtists([]);
  }

  // The teacher's real Spotify top genres, derived client-side from the
  // top artists' own genre tags (Spotify has no separate "top genres"
  // endpoint). These are what her Spotify account happens to stream —
  // often not yoga-appropriate on their own — so they're offered as an
  // "exclude" list (below), not fed directly into "Suggested for you".
  const realTopGenres = useMemo(() => {
    const counts = new Map<string, number>();
    for (const artist of topArtists) {
      for (const genre of artist.genres) {
        counts.set(genre, (counts.get(genre) ?? 0) + 1);
      }
    }
    return [...counts.entries()]
      .sort((a, b) => b[1] - a[1])
      .slice(0, 8)
      .map(([genre]) => genre);
  }, [topArtists]);

  function seedSearchFromArtist(name: string) {
    setSearchSeed((prev) => ({ query: `artist:"${name}"`, nonce: (prev?.nonce ?? 0) + 1 }));
  }

  // Which of her real top artists are actually tagged with a genre she's
  // picked in "Genres to suggest from" — shown right under that picker so
  // she can see, at a glance, which of her own artists fit her selection.
  const matchingTopArtists = useMemo(() => {
    if (preferredGenres.length === 0) return [];
    const preferredLower = new Set(preferredGenres.map((g) => g.toLowerCase()));
    return topArtists.filter((a) => a.genres.some((g) => preferredLower.has(g.toLowerCase())));
  }, [topArtists, preferredGenres]);

  // "Show more artists" — beyond her own top list, search Spotify for
  // other artists tagged with the genres she picked.
  async function discoverMoreArtists() {
    if (preferredGenres.length === 0) return;
    setDiscoveringArtists(true);
    setDiscoverArtistsError(null);
    try {
      const seen = new Set(topArtists.map((a) => a.id));
      const found: ArtistSummary[] = [];
      for (const genre of preferredGenres.slice(0, 3)) {
        const res = await fetch(
          `/api/music/search/artists?q=${encodeURIComponent(`genre:"${genre}"`)}`,
        );
        if (!res.ok) continue;
        const data = await res.json();
        for (const artist of (data.items ?? []) as ArtistSummary[]) {
          if (!seen.has(artist.id)) {
            seen.add(artist.id);
            found.push(artist);
          }
        }
      }
      setDiscoveredArtists(found.slice(0, 12));
      if (found.length === 0) {
        setDiscoverArtistsError("Nessun altro artista trovato per questi generi.");
      }
    } catch {
      setDiscoverArtistsError("Ricerca artisti non riuscita. Controlla la connessione.");
    } finally {
      setDiscoveringArtists(false);
    }
  }

  const scheduleSave = useCallback(
    (next: ClassSession, nextOrder: DraftTrack[]) => {
      setSavedState("saving");
      if (saveTimer.current) clearTimeout(saveTimer.current);
      saveTimer.current = setTimeout(() => {
        localClassSessionRepository.save({
          ...next,
          updatedAt: new Date().toISOString(),
        });
        try {
          window.localStorage.setItem(
            `ima-yoga-tracks-${id}`,
            JSON.stringify(nextOrder),
          );
        } catch {
          // ignore
        }
        setSavedState("saved");
      }, AUTOSAVE_DELAY_MS);
    },
    [id],
  );

  function updateSession(patch: Partial<ClassSession>) {
    setSession((prev) => {
      if (!prev) return prev;
      const next = { ...prev, ...patch };
      scheduleSave(next, order);
      return next;
    });
  }

  function updateOrder(next: DraftTrack[]) {
    setOrder(next);
    if (session) scheduleSave(session, next);
  }

  function handleCurveChange(curve: EnergyCurve) {
    updateSession({ curve });
  }

  function handleDurationChange(newDurationMin: number) {
    if (!session) return;
    const newDurationSec = newDurationMin * 60;
    const scaledCurve = scaleCurveToDuration(session.curve, newDurationSec);
    const normalizedPhases = normalizePhases(session.phases, session.durationSec);
    const scaledPhases = applyPhasesToDuration(normalizedPhases, newDurationSec);
    updateSession({
      durationSec: newDurationSec,
      curve: scaledCurve,
      phases: scaledPhases,
    });
  }

  // Fills the whole class automatically with real Spotify tracks, using
  // the energy arc, the genre picker, and the Music Intent dials —
  // exactly the same signals "Suggested for you" already uses (per track)
  // and "Fit to curve" already respects (locks). Locked 🔒 tracks are
  // kept exactly where they are; every unlocked track is replaced. Run it
  // again any time after changing the arc, genres, or Music Intent to
  // bring the rest of the draft up to date — it always regenerates from
  // scratch using whatever the current tuning is.
  async function generatePlaylist() {
    if (!session || !spotifyConnected) return;
    setGenerateState({ status: "generating", added: 0 });

    const segments = planDraftSegments(order, session.curve);
    const next: DraftTrack[] = [];
    const artistCounts = new Map<string, number>();
    for (const seg of segments) {
      if (seg.type === "locked") {
        const key = seg.track.artist.toLowerCase();
        artistCounts.set(key, (artistCounts.get(key) ?? 0) + 1);
      }
    }

    let rotation = 0;
    let added = 0;
    let hadError = false;
    const topArtistNames = topArtists.map((a) => a.name);

    for (const seg of segments) {
      if (seg.type === "locked") {
        next.push(seg.track);
        continue;
      }

      let cursorSec = seg.startSec;
      let attemptsWithoutSuccess = 0;
      while (
        seg.endSec - cursorSec >= GENERATE_MIN_LEFTOVER_SEC &&
        attemptsWithoutSuccess < GENERATE_MAX_ATTEMPTS_PER_SLOT
      ) {
        const targetEnergy = sampleEnergyAt(
          session.curve,
          Math.min(cursorSec, session.curve.durationSec),
        );
        const seedPick = pickMoodSuggestionSeed(
          targetEnergy,
          {
            preferredGenres,
            excludedGenres,
            organicElectronic: session.musicIntent.organicElectronic,
            drive: session.musicIntent.drive,
          },
          rotation,
        );
        rotation++;

        try {
          const query = buildSuggestionSearchQuery(seedPick.genre, session.musicIntent.vocals);
          const res = await fetch(`/api/music/search/tracks?q=${encodeURIComponent(query)}`);
          if (!res.ok) {
            attemptsWithoutSuccess++;
            continue;
          }
          const data = await res.json();
          const candidates: TrackSummary[] = data.items ?? [];
          const ranked = rankByFamiliarity(
            candidates,
            topArtistNames,
            session.musicIntent.familiarity,
          );
          const alreadyPicked = (t: TrackSummary) =>
            next.some((d) => d.source === "spotify" && d.id === t.id);
          const withinDiversity = (t: TrackSummary) =>
            (artistCounts.get(t.artist.toLowerCase()) ?? 0) < GENERATE_MAX_PER_ARTIST;
          const chosen =
            ranked.find((t) => !alreadyPicked(t) && withinDiversity(t)) ??
            ranked.find((t) => !alreadyPicked(t));

          if (!chosen) {
            attemptsWithoutSuccess++;
            continue;
          }

          const newTrack: DraftTrack = {
            id: chosen.id,
            source: "spotify",
            spotifyUri: chosen.uri,
            title: chosen.title,
            artist: chosen.artist,
            durationMs: chosen.durationMs,
            // Picked deliberately for this slot's mood, so we can seed a
            // real rating instead of the usual neutral default — she can
            // always correct it herself afterward.
            energyEstimate: energyLabelMidpoint(seedPick.moodLabel),
            vocalsLevel: 50,
            locked: false,
          };
          next.push(newTrack);
          artistCounts.set(
            chosen.artist.toLowerCase(),
            (artistCounts.get(chosen.artist.toLowerCase()) ?? 0) + 1,
          );
          cursorSec += newTrack.durationMs / 1000;
          added++;
          attemptsWithoutSuccess = 0;
          setGenerateState({ status: "generating", added });
        } catch {
          hadError = true;
          attemptsWithoutSuccess++;
        }
      }
    }

    updateOrder(next);
    setGenerateState(
      hadError
        ? {
            status: "error",
            added,
            message: `Generati ${added} brani, poi la ricerca Spotify non ha risposto — completa a mano o riprova.`,
          }
        : { status: "done", added },
    );
  }

  const exportableUris = useMemo(
    () =>
      order
        .filter((t) => t.source === "spotify" && t.spotifyUri)
        .map((t) => t.spotifyUri as string),
    [order],
  );

  async function handleExport() {
    if (!session || exportableUris.length === 0) return;
    setExportState({ status: "exporting" });

    // Open the destination tab synchronously, inside the click's user
    // gesture — opening it later (after the await below) is what browsers'
    // popup blockers silently swallow, which is why "nothing seemed to
    // happen" before. We navigate this same tab once we have the real URL.
    const destinationTab = window.open("about:blank", "_blank");

    try {
      const res = await fetch(`/api/sessions/${id}/export`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: session.title,
          isPublic: isPublicExport,
          uris: exportableUris,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        destinationTab?.close();
        const message =
          data.code === "AUTH_EXPIRED" || data.code === "NOT_CONNECTED"
            ? "La sessione Spotify è scaduta — riconnettiti e riprova."
            : data.code === "QUOTA_EXCEEDED"
              ? "Quota Spotify esaurita per oggi — riprova più tardi."
              : data.code === "RATE_LIMITED"
                ? "Troppe richieste a Spotify — riprova tra poco."
                : (data.message ?? "Esportazione non riuscita.");
        setExportState({ status: "error", message });
        if (data.code === "AUTH_EXPIRED" || data.code === "NOT_CONNECTED") {
          setSpotifyConnected(false);
        }
        return;
      }
      if (destinationTab) {
        destinationTab.location.href = data.playlistUrl;
      }
      setExportState({ status: "done", playlistUrl: data.playlistUrl });
    } catch {
      destinationTab?.close();
      setExportState({
        status: "error",
        message: "Esportazione non riuscita. Controlla la connessione.",
      });
    }
  }

  const validation = useMemo(
    () => (session ? validateCurve(session.curve) : null),
    [session],
  );

  if (session === undefined) {
    return (
      <div className="flex flex-1 items-center justify-center text-text-muted">
        Loading…
      </div>
    );
  }

  if (session === null) {
    return (
      <div className="flex flex-1 flex-col items-center justify-center gap-4 px-6 text-center">
        <p className="text-text-muted">
          This session doesn&apos;t exist in this browser yet.
        </p>
        <Link href="/sessions/new">
          <Button>Shape a new class</Button>
        </Link>
      </div>
    );
  }

  const preset = CLASS_TYPE_PRESETS[session.classType];

  return (
    <div className="flex flex-1 flex-col">
      <header className="flex flex-wrap items-center justify-between gap-3 border-b border-border px-6 py-4 sm:px-10">
        <div className="flex items-center gap-3">
          <Link href="/" className="text-sm text-text-muted hover:text-text">
            ←
          </Link>
          <div>
            <input
              value={session.title}
              onChange={(e) => updateSession({ title: e.target.value })}
              className="bg-transparent text-lg font-semibold text-text outline-none focus:underline"
              aria-label="Session title"
            />
            <div className="text-xs text-text-muted">
              {preset.label} · {Math.round(session.durationSec / 60)} min
            </div>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <span className="text-xs text-text-muted">
            {savedState === "saving" ? "Saving…" : "Saved"}
          </span>
          <Button
            variant="secondary"
            size="sm"
            onClick={generatePlaylist}
            disabled={!spotifyConnected || generateState.status === "generating"}
            title={
              !spotifyConnected
                ? "Connect Spotify first"
                : "Fills every unlocked 🔓 slot with real Spotify tracks matched to the energy arc, your genre picks, and Music Intent. Locked 🔒 tracks are kept. Run it again any time you change the tuning to update the rest."
            }
          >
            {generateState.status === "generating"
              ? `Generating… (${generateState.added})`
              : "Generate playlist"}
          </Button>
          <Button
            size="sm"
            onClick={handleExport}
            disabled={
              !spotifyConnected ||
              exportableUris.length === 0 ||
              exportState.status === "exporting"
            }
            title={
              !spotifyConnected
                ? "Connect Spotify first"
                : exportableUris.length === 0
                  ? "Add at least one real Spotify track to the draft first"
                  : undefined
            }
          >
            {exportState.status === "exporting" ? "Exporting…" : "Export to Spotify"}
          </Button>
          <ThemeToggle />
        </div>
      </header>

      {spotifyBanner && (
        <div className="border-b border-border bg-surface-subtle px-6 py-2 text-xs text-text sm:px-10">
          {spotifyBanner}{" "}
          <button
            type="button"
            onClick={() => setSpotifyBanner(null)}
            className="ml-2 text-text-muted underline"
          >
            dismiss
          </button>
        </div>
      )}

      {exportState.status === "done" && (
        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-border bg-sage-soft px-6 py-3 text-sm text-sage-strong sm:px-10">
          <span>Playlist creata su Spotify.</span>
          <div className="flex items-center gap-3">
            <a href={exportState.playlistUrl} target="_blank" rel="noopener noreferrer">
              <Button size="sm">Apri playlist ↗</Button>
            </a>
            <button
              type="button"
              onClick={() => setExportState({ status: "idle" })}
              className="text-xs text-sage-strong underline"
            >
              dismiss
            </button>
          </div>
        </div>
      )}
      {exportState.status === "error" && (
        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-border bg-danger/10 px-6 py-3 text-sm text-danger sm:px-10">
          <span>{exportState.message}</span>
          <button
            type="button"
            onClick={() => setExportState({ status: "idle" })}
            className="text-xs text-danger underline"
          >
            dismiss
          </button>
        </div>
      )}

      {generateState.status === "done" && (
        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-border bg-sage-soft px-6 py-3 text-sm text-sage-strong sm:px-10">
          <span>
            Playlist generata: {generateState.added} nuovo{generateState.added === 1 ? "" : "i"}{" "}
            brano{generateState.added === 1 ? "" : "i"} da Spotify.
          </span>
          <button
            type="button"
            onClick={() => setGenerateState({ status: "idle" })}
            className="text-xs text-sage-strong underline"
          >
            dismiss
          </button>
        </div>
      )}
      {generateState.status === "error" && (
        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-border bg-danger/10 px-6 py-3 text-sm text-danger sm:px-10">
          <span>{generateState.message}</span>
          <button
            type="button"
            onClick={() => setGenerateState({ status: "idle" })}
            className="text-xs text-danger underline"
          >
            dismiss
          </button>
        </div>
      )}

      <main className="mx-auto grid w-full max-w-6xl flex-1 gap-8 px-6 py-8 sm:px-10 lg:grid-cols-[1fr_18rem]">
        <div className="space-y-8">
          <section className="rounded-[var(--radius-panel)] border border-border bg-surface p-5">
            <div className="mb-3 flex items-center justify-between">
              <h2 className="text-sm font-medium text-text">Energy arc</h2>
              <div className="flex gap-1">
                {[45, 60, 70, 75, 90].map((min) => (
                  <button
                    key={min}
                    type="button"
                    onClick={() => handleDurationChange(min)}
                    className={`h-7 rounded-full px-2.5 text-[11px] ${
                      Math.round(session.durationSec / 60) === min
                        ? "bg-primary text-white"
                        : "text-text-muted hover:bg-surface-subtle"
                    }`}
                  >
                    {min}m
                  </button>
                ))}
              </div>
            </div>
            <EnergyCurveEditor
              curve={session.curve}
              phases={session.phases}
              onChange={handleCurveChange}
            />
            {validation && !validation.valid && (
              <p className="mt-2 text-xs text-warning">
                This curve has {validation.errors.length} issue
                {validation.errors.length === 1 ? "" : "s"} to resolve before
                export.
              </p>
            )}
          </section>

          <section className="rounded-[var(--radius-panel)] border border-border bg-surface p-5">
            <TrackRail
              order={order}
              curve={session.curve}
              connected={spotifyConnected}
              seed={searchSeed}
              preferredGenres={preferredGenres}
              excludedGenres={excludedGenres}
              musicIntent={session.musicIntent}
              topArtistNames={topArtists.map((a) => a.name)}
              onChange={updateOrder}
            />

            {spotifyConnected && exportableUris.length > 0 && (
              <label className="mt-3 flex items-center gap-2 text-xs text-text-muted">
                <input
                  type="checkbox"
                  checked={isPublicExport}
                  onChange={(e) => setIsPublicExport(e.target.checked)}
                  className="accent-primary"
                />
                Make the exported playlist public
              </label>
            )}
          </section>
        </div>

        <aside className="space-y-6">
          <section className="rounded-[var(--radius-panel)] border border-border bg-surface p-5">
            <h2 className="text-sm font-medium text-text">Spotify</h2>
            {spotifyConnected ? (
              <>
                <p className="mt-2 text-xs text-sage-strong">
                  Connected{spotifyDisplayName ? ` as ${spotifyDisplayName}` : ""}
                </p>
                {topArtists.length > 0 && (
                  <div className="mt-3">
                    <div className="text-[11px] text-text-muted">
                      Your top artists — tap one to search its tracks
                    </div>
                    <div className="mt-1.5 flex flex-wrap gap-1.5">
                      {topArtists.map((a) => (
                        <button
                          key={a.id}
                          type="button"
                          onClick={() => seedSearchFromArtist(a.name)}
                          className="rounded-full bg-surface-subtle px-2 py-1 text-[11px] text-text hover:bg-primary hover:text-white"
                        >
                          {a.name}
                        </button>
                      ))}
                    </div>
                  </div>
                )}
                <div className="mt-3">
                  <div className="text-[11px] text-text-muted">
                    Genres to suggest from — pick as many as you like (yoga-appropriate
                    genres and subgenres; leave empty to use our default mix for each
                    mood)
                  </div>
                  <div className="mt-1.5 flex flex-wrap gap-1.5">
                    {ALL_YOGA_GENRES.map((genre) => {
                      const selected = preferredGenres.includes(genre);
                      return (
                        <button
                          key={genre}
                          type="button"
                          onClick={() => togglePreferredGenre(genre)}
                          aria-pressed={selected}
                          className={`rounded-full px-2 py-1 text-[11px] ${
                            selected
                              ? "bg-primary text-white"
                              : "bg-surface-subtle text-text hover:bg-primary hover:text-white"
                          }`}
                        >
                          {genre}
                        </button>
                      );
                    })}
                  </div>
                </div>
                {preferredGenres.length > 0 && (
                  <div className="mt-3">
                    <div className="text-[11px] text-text-muted">
                      Your top artists matching these genres
                    </div>
                    {matchingTopArtists.length > 0 ? (
                      <div className="mt-1.5 flex flex-wrap gap-1.5">
                        {matchingTopArtists.map((a) => (
                          <button
                            key={a.id}
                            type="button"
                            onClick={() => seedSearchFromArtist(a.name)}
                            className="rounded-full bg-surface-subtle px-2 py-1 text-[11px] text-text hover:bg-primary hover:text-white"
                          >
                            {a.name}
                          </button>
                        ))}
                      </div>
                    ) : (
                      <p className="mt-1 text-[11px] text-text-muted">
                        None of your top artists are tagged with these genres.
                      </p>
                    )}
                    <button
                      type="button"
                      onClick={discoverMoreArtists}
                      disabled={discoveringArtists}
                      className="mt-1.5 text-[11px] text-text-muted underline hover:text-text disabled:opacity-50"
                    >
                      {discoveringArtists ? "Searching…" : "Show more artists →"}
                    </button>
                    {discoverArtistsError && (
                      <p className="mt-1 text-[11px] text-danger">{discoverArtistsError}</p>
                    )}
                    {discoveredArtists.length > 0 && (
                      <div className="mt-1.5 flex flex-wrap gap-1.5">
                        {discoveredArtists.map((a) => (
                          <button
                            key={a.id}
                            type="button"
                            onClick={() => seedSearchFromArtist(a.name)}
                            title="New to you — not in your top artists"
                            className="rounded-full bg-surface-subtle px-2 py-1 text-[11px] text-text hover:bg-primary hover:text-white"
                          >
                            {a.name} ✦
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                )}
                {realTopGenres.length > 0 && (
                  <div className="mt-3">
                    <div className="text-[11px] text-text-muted">
                      Never suggest — from your real Spotify top genres, in case any
                      don&apos;t belong in a yoga class
                    </div>
                    <div className="mt-1.5 flex flex-wrap gap-1.5">
                      {realTopGenres.map((genre) => {
                        const selected = excludedGenres.includes(genre);
                        return (
                          <button
                            key={genre}
                            type="button"
                            onClick={() => toggleExcludedGenre(genre)}
                            aria-pressed={selected}
                            className={`rounded-full px-2 py-1 text-[11px] ${
                              selected
                                ? "bg-danger text-white"
                                : "bg-surface-subtle text-text hover:bg-danger hover:text-white"
                            }`}
                          >
                            {genre}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                )}
                <Button
                  variant="secondary"
                  size="sm"
                  onClick={disconnectSpotify}
                  className="mt-3"
                >
                  Disconnect
                </Button>
              </>
            ) : (
              <>
                <p className="mt-2 text-xs text-text-muted">
                  Connect your Spotify account to search real tracks and export
                  the finished playlist.
                </p>
                <a href={`/api/spotify/connect?returnTo=/sessions/${id}`}>
                  <Button size="sm" className="mt-3">
                    Connect Spotify
                  </Button>
                </a>
              </>
            )}
          </section>

          <section className="rounded-[var(--radius-panel)] border border-border bg-surface p-5">
            <h2 className="text-sm font-medium text-text">Music intent</h2>
            <p className="mt-1 text-[11px] text-text-muted">
              Shapes &quot;Suggested for you&quot; and &quot;Generate playlist&quot; — change
              a dial and either regenerate the rest, or run &quot;Generate playlist&quot;
              again to update everything unlocked.
            </p>
            <div className="mt-4 space-y-4">
              <IntentSlider
                label="Discovery ↔ Familiar"
                value={session.musicIntent.familiarity}
                title="Biases which search results surface first: your own top artists (Familiar) or names you don't already know (Discovery). Never changes which tracks are found, only their order."
                onChange={(v) =>
                  updateSession({ musicIntent: { ...session.musicIntent, familiarity: v } })
                }
              />
              <IntentSlider
                label="Instrumental ↔ Vocal"
                value={session.musicIntent.vocals}
                title="Below ~30, adds an 'instrumental' keyword to the Spotify search — there's no real audio-feature signal to filter on, so this only works as well as Spotify's own text search does."
                onChange={(v) =>
                  updateSession({ musicIntent: { ...session.musicIntent, vocals: v } })
                }
              />
              <IntentSlider
                label="Organic ↔ Electronic"
                value={session.musicIntent.organicElectronic}
                title="Leans genre picks toward acoustic/organic or electronic-leaning entries in the curated yoga genre list, when both exist for the current mood."
                onChange={(v) =>
                  updateSession({
                    musicIntent: { ...session.musicIntent, organicElectronic: v },
                  })
                }
              />
              <IntentSlider
                label="Soft ↔ Driving"
                value={session.musicIntent.drive}
                title="Gently nudges the energy target used for genre picks (up to about ±10) without changing the arc you drew — a general appetite for more or less propulsive music."
                onChange={(v) =>
                  updateSession({ musicIntent: { ...session.musicIntent, drive: v } })
                }
              />
            </div>
          </section>
        </aside>
      </main>
    </div>
  );
}

function IntentSlider({
  label,
  value,
  title,
  onChange,
}: {
  label: string;
  value: number;
  title?: string;
  onChange: (value: number) => void;
}) {
  return (
    <label className="block" title={title}>
      <span className="text-xs text-text-muted">{label}</span>
      <input
        type="range"
        min={0}
        max={100}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        className="mt-1 w-full accent-primary"
      />
    </label>
  );
}
