"use client";

import { useEffect, useMemo, useState, type FormEvent } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/Button";
import { localClassSessionRepository } from "@/domain/class-session/repository";
import { localPlaylistImportRepository } from "@/domain/class-session/importRepository";
import { createSessionFromImport } from "@/domain/class-session/createSessionFromImport";
import type { PlaylistImport, PlaylistImportOwnership } from "@/domain/class-session/types";
import { parseSpotifyPlaylistRef } from "@/integrations/spotify/parsePlaylistRef";
import type { SpotifyPlaylistSummary } from "@/integrations/spotify/types";

type PickerState =
  | { status: "idle" }
  | { status: "loading" }
  | { status: "loaded"; items: SpotifyPlaylistSummary[] }
  | { status: "error"; message: string };

type FetchedImport = {
  sourceSpotifyPlaylistId: string;
  sourceOwnerSpotifyUserId?: string;
  ownership: PlaylistImportOwnership;
  originalName: string;
  originalDescription?: string;
  trackSnapshot: PlaylistImport["trackSnapshot"];
};

type FetchState =
  | { status: "idle" }
  | { status: "fetching" }
  | { status: "loaded"; data: FetchedImport }
  | { status: "error"; message: string };

function newId(): string {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID();
  }
  return `import-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}

function formatDuration(totalMs: number): string {
  const totalSec = Math.round(totalMs / 1000);
  const h = Math.floor(totalSec / 3600);
  const m = Math.round((totalSec % 3600) / 60);
  return h > 0 ? `${h}h ${m}min` : `${m} min`;
}

function errorMessageForCode(code: string | undefined): string {
  switch (code) {
    case "FORBIDDEN":
      // Exact copy per 05_PLAYLIST_RESHAPE.md — "Spotify integration
      // requirements": the Development Mode foreign-playlist caveat is an
      // expected, actionable state, not a bug to work around.
      return "This playlist isn't readable with your connected account. Try one of your own or a collaborative playlist.";
    case "NOT_FOUND":
      return "Playlist not found — check the link and try again.";
    case "AUTH_EXPIRED":
    case "NOT_CONNECTED":
      return "La sessione Spotify è scaduta — riconnettiti e riprova.";
    case "QUOTA_EXCEEDED":
      return "Quota Spotify esaurita per oggi — riprova più tardi.";
    case "RATE_LIMITED":
      return "Troppe richieste a Spotify — riprova tra poco.";
    default:
      return "Impossibile caricare questa playlist. Riprova.";
  }
}

export default function ImportPlaylistPage() {
  const router = useRouter();
  const [spotifyConnected, setSpotifyConnected] = useState<boolean | null>(null);
  const [picker, setPicker] = useState<PickerState>({ status: "idle" });
  const [query, setQuery] = useState("");
  const [pasteInput, setPasteInput] = useState("");
  const [pasteError, setPasteError] = useState<string | null>(null);
  const [fetched, setFetched] = useState<FetchState>({ status: "idle" });
  const [creating, setCreating] = useState(false);

  useEffect(() => {
    let cancelled = false;
    fetch("/api/music/status")
      .then((res) => res.json())
      .then((data) => {
        if (!cancelled) setSpotifyConnected(Boolean(data.connected));
      })
      .catch(() => {
        if (!cancelled) setSpotifyConnected(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (!spotifyConnected) return;
    let cancelled = false;
    // Synchronous state update in response to the spotifyConnected signal
    // changing — the sanctioned "respond to an external trigger" pattern
    // used throughout this app (e.g. TrackRail's suggestion effect).
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setPicker({ status: "loading" });
    fetch("/api/music/playlists")
      .then((res) => res.json())
      .then((data) => {
        if (cancelled) return;
        setPicker({ status: "loaded", items: data.items ?? [] });
      })
      .catch(() => {
        if (!cancelled) {
          setPicker({
            status: "error",
            message: "Impossibile caricare le tue playlist. Riprova.",
          });
        }
      });
    return () => {
      cancelled = true;
    };
  }, [spotifyConnected]);

  const filteredPlaylists = useMemo(() => {
    if (picker.status !== "loaded") return [];
    const q = query.trim().toLowerCase();
    if (!q) return picker.items;
    return picker.items.filter((p) => p.name.toLowerCase().includes(q));
  }, [picker, query]);

  async function fetchPlaylist(playlistId: string) {
    setFetched({ status: "fetching" });
    try {
      const res = await fetch(`/api/music/playlists/${playlistId}`);
      const data = await res.json();
      if (!res.ok) {
        setFetched({ status: "error", message: errorMessageForCode(data.code) });
        return;
      }
      setFetched({ status: "loaded", data });
    } catch {
      setFetched({
        status: "error",
        message: "Impossibile caricare questa playlist. Controlla la connessione.",
      });
    }
  }

  function handlePickPlaylist(playlist: SpotifyPlaylistSummary) {
    setPasteError(null);
    fetchPlaylist(playlist.id);
  }

  function handlePasteSubmit(e: FormEvent) {
    e.preventDefault();
    const playlistId = parseSpotifyPlaylistRef(pasteInput);
    if (!playlistId) {
      setPasteError("Incolla un link, URI o ID di una playlist Spotify valido.");
      return;
    }
    setPasteError(null);
    fetchPlaylist(playlistId);
  }

  function handleInferCurve() {
    if (fetched.status !== "loaded" || creating) return;
    setCreating(true);
    const playlistImport: PlaylistImport = {
      id: newId(),
      sourceSpotifyPlaylistId: fetched.data.sourceSpotifyPlaylistId,
      sourceOwnerSpotifyUserId: fetched.data.sourceOwnerSpotifyUserId,
      ownership: fetched.data.ownership,
      originalName: fetched.data.originalName,
      originalDescription: fetched.data.originalDescription,
      trackSnapshot: fetched.data.trackSnapshot,
      importedAt: new Date().toISOString(),
    };
    localPlaylistImportRepository.save(playlistImport);

    const { session, order } = createSessionFromImport(playlistImport);
    localClassSessionRepository.save(session);
    if (typeof window !== "undefined") {
      try {
        window.localStorage.setItem(`ima-yoga-tracks-${session.id}`, JSON.stringify(order));
      } catch {
        // ignore — the session still saved; the draft just won't be pre-populated on load
      }
    }
    router.push(`/sessions/${session.id}`);
  }

  const totalDurationMs =
    fetched.status === "loaded"
      ? fetched.data.trackSnapshot.reduce((sum, t) => sum + t.durationMs, 0)
      : 0;
  const isEmpty = fetched.status === "loaded" && fetched.data.trackSnapshot.length === 0;

  return (
    <div className="flex flex-1 flex-col">
      <header className="flex items-center gap-3 px-6 py-5 sm:px-10">
        <Link href="/sessions/new" className="text-sm text-text-muted hover:text-text">
          ← Back
        </Link>
      </header>

      <main className="mx-auto w-full max-w-2xl flex-1 px-6 pb-16 sm:px-10">
        <h1 className="text-2xl font-semibold text-text">Import a playlist</h1>
        <p className="mt-1 text-sm text-text-muted">
          We&apos;ll infer a starting energy curve from this playlist&apos;s own tracks —
          you reshape it from there, and the export always creates a new playlist.
        </p>

        {spotifyConnected === false && (
          <div className="mt-8 rounded-[var(--radius-card)] border border-border bg-surface p-5">
            <p className="text-sm text-text-muted">
              Connect Spotify to search your playlists and infer a curve from one.
            </p>
            <a href="/api/spotify/connect?returnTo=/sessions/new/import">
              <Button size="sm" className="mt-3">
                Connect Spotify
              </Button>
            </a>
          </div>
        )}

        {spotifyConnected && (
          <>
            <section className="mt-8">
              <label htmlFor="playlist-search" className="text-sm font-medium text-text">
                Your playlists
              </label>
              <input
                id="playlist-search"
                type="text"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search by name…"
                className="mt-2 h-11 w-full rounded-[var(--radius-control)] border border-border bg-surface px-4 text-sm text-text"
              />

              {picker.status === "loading" && (
                <p className="mt-3 text-sm text-text-muted">Loading your playlists…</p>
              )}
              {picker.status === "error" && (
                <p className="mt-3 text-sm text-danger">{picker.message}</p>
              )}
              {picker.status === "loaded" && (
                <ul className="mt-3 max-h-72 space-y-1 overflow-y-auto">
                  {filteredPlaylists.length === 0 && (
                    <li className="text-sm text-text-muted">No playlists match “{query}”.</li>
                  )}
                  {filteredPlaylists.map((p) => (
                    <li key={p.id}>
                      <button
                        type="button"
                        onClick={() => handlePickPlaylist(p)}
                        className="flex w-full items-center justify-between gap-3 rounded-[var(--radius-control)] px-3 py-2 text-left text-sm hover:bg-surface-subtle"
                      >
                        <span className="truncate font-medium text-text">{p.name}</span>
                        <span className="shrink-0 text-xs text-text-muted">
                          {p.trackCount} track{p.trackCount === 1 ? "" : "s"}
                        </span>
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </section>

            <section className="mt-8">
              <h2 className="text-sm font-medium text-text">
                Or paste a playlist link{" "}
                <span className="font-normal text-text-muted">(yours or someone else&apos;s)</span>
              </h2>
              <form onSubmit={handlePasteSubmit} className="mt-2 flex gap-2">
                <input
                  type="text"
                  value={pasteInput}
                  onChange={(e) => setPasteInput(e.target.value)}
                  placeholder="https://open.spotify.com/playlist/…"
                  className="h-11 flex-1 rounded-[var(--radius-control)] border border-border bg-surface px-4 text-sm text-text"
                  aria-label="Playlist URL, URI, or ID"
                />
                <Button type="submit" variant="secondary">
                  Fetch
                </Button>
              </form>
              {pasteError && <p className="mt-2 text-xs text-danger">{pasteError}</p>}
              <p className="mt-2 text-[11px] text-text-muted">
                A playlist that isn&apos;t yours or shared with you may not be readable —
                Spotify Development Mode can restrict access to your own and collaborative
                playlists only.
              </p>
            </section>

            {fetched.status === "fetching" && (
              <p className="mt-6 text-sm text-text-muted">Fetching playlist…</p>
            )}
            {fetched.status === "error" && (
              <p className="mt-6 text-sm text-danger">{fetched.message}</p>
            )}
            {isEmpty && (
              <p className="mt-6 text-sm text-danger">This playlist has no tracks to import.</p>
            )}
            {fetched.status === "loaded" && !isEmpty && (
              <div className="mt-6 rounded-[var(--radius-card)] border border-border bg-surface p-5">
                <div className="font-medium text-text">{fetched.data.originalName}</div>
                <p className="mt-1 text-sm text-text-muted">
                  {fetched.data.trackSnapshot.length} tracks ·{" "}
                  {formatDuration(totalDurationMs)}
                  {fetched.data.ownership !== "own" && (
                    <> · {fetched.data.ownership === "collaborative" ? "collaborative" : "not yours"}</>
                  )}
                </p>
                <Button onClick={handleInferCurve} disabled={creating} className="mt-4">
                  {creating ? "Inferring…" : "Infer energy curve"}
                </Button>
              </div>
            )}
          </>
        )}
      </main>
    </div>
  );
}
