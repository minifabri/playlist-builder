import type { PlaylistImport } from "./types";

/**
 * Repository boundary for PlaylistImport snapshots
 * (05_PLAYLIST_RESHAPE.md — "Data model additions"). Mirrors
 * ClassSessionRepository's localStorage-backed shape — same MVP rationale
 * (11_ENV_AND_SETUP.md): a database-backed implementation can satisfy this
 * interface later without touching UI code.
 */
export interface PlaylistImportRepository {
  get(id: string): PlaylistImport | undefined;
  save(playlistImport: PlaylistImport): void;
}

const STORAGE_KEY = "ima-yoga-playlist-imports";

function readAll(): Record<string, PlaylistImport> {
  if (typeof window === "undefined") return {};
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    return raw ? (JSON.parse(raw) as Record<string, PlaylistImport>) : {};
  } catch {
    return {};
  }
}

function writeAll(imports: Record<string, PlaylistImport>): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(imports));
  } catch {
    // Storage unavailable (private mode, quota) — fail silently, same as
    // localClassSessionRepository.
  }
}

export const localPlaylistImportRepository: PlaylistImportRepository = {
  get(id) {
    return readAll()[id];
  },
  save(playlistImport) {
    const all = readAll();
    all[playlistImport.id] = playlistImport;
    writeAll(all);
  },
};
