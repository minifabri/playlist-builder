"use client";

import { use, useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Button } from "@/components/ui/Button";
import { ThemeToggle } from "@/components/theme/ThemeToggle";
import { EnergyCurveEditor } from "@/components/energy-editor/EnergyCurveEditor";
import { TrackRail } from "@/components/playlist/TrackRail";
import { CLASS_TYPE_PRESETS } from "@/domain/class-session/presets";
import { localClassSessionRepository } from "@/domain/class-session/repository";
import type { ClassSession } from "@/domain/class-session/types";
import type { EnergyCurve } from "@/domain/energy/types";
import { scaleCurveToDuration, applyPhasesToDuration, normalizePhases } from "@/domain/energy/scaleCurve";
import { validateCurve } from "@/domain/energy/validateCurve";
import type { DraftTrack } from "@/domain/playlist/types";
import { generateMockDraft } from "@/domain/playlist/generateMockDraft";
import type { ArtistSummary } from "@/integrations/spotify/types";

const AUTOSAVE_DELAY_MS = 700;

type ExportState =
  | { status: "idle" }
  | { status: "exporting" }
  | { status: "done"; playlistUrl: string }
  | { status: "error"; message: string };

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
  const [spotifyBanner, setSpotifyBanner] = useState<string | null>(null);
  const [topArtists, setTopArtists] = useState<ArtistSummary[]>([]);
  const [isPublicExport, setIsPublicExport] = useState(false);
  const [exportState, setExportState] = useState<ExportState>({ status: "idle" });

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
    }
  }, [id]);

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
    } catch {
      setSpotifyConnected(false);
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
    setTopArtists([]);
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

  function handleGenerateDraft() {
    if (!session) return;
    updateOrder(generateMockDraft(session.curve));
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
      setExportState({ status: "done", playlistUrl: data.playlistUrl });
    } catch {
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
          <Button variant="secondary" size="sm" onClick={handleGenerateDraft}>
            Generate draft
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
              onChange={updateOrder}
            />

            {exportState.status === "done" && (
              <p className="mt-3 text-xs text-sage-strong">
                Playlist creata su Spotify —{" "}
                <a
                  href={exportState.playlistUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="underline"
                >
                  aprila su Spotify
                </a>
                .
              </p>
            )}
            {exportState.status === "error" && (
              <p className="mt-3 text-xs text-danger">{exportState.message}</p>
            )}
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
                <p className="mt-2 text-xs text-sage-strong">Connected</p>
                {topArtists.length > 0 && (
                  <div className="mt-3">
                    <div className="text-[11px] text-text-muted">Your top artists</div>
                    <div className="mt-1.5 flex flex-wrap gap-1.5">
                      {topArtists.map((a) => (
                        <span
                          key={a.id}
                          className="rounded-full bg-surface-subtle px-2 py-1 text-[11px] text-text"
                        >
                          {a.name}
                        </span>
                      ))}
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
            <div className="mt-4 space-y-4">
              <IntentSlider
                label="Discovery ↔ Familiar"
                value={session.musicIntent.familiarity}
                onChange={(v) =>
                  updateSession({ musicIntent: { ...session.musicIntent, familiarity: v } })
                }
              />
              <IntentSlider
                label="Instrumental ↔ Vocal"
                value={session.musicIntent.vocals}
                onChange={(v) =>
                  updateSession({ musicIntent: { ...session.musicIntent, vocals: v } })
                }
              />
              <IntentSlider
                label="Organic ↔ Electronic"
                value={session.musicIntent.organicElectronic}
                onChange={(v) =>
                  updateSession({
                    musicIntent: { ...session.musicIntent, organicElectronic: v },
                  })
                }
              />
              <IntentSlider
                label="Soft ↔ Driving"
                value={session.musicIntent.drive}
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
  onChange,
}: {
  label: string;
  value: number;
  onChange: (value: number) => void;
}) {
  return (
    <label className="block">
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
