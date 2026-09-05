import type { ClassSession } from "./types";

/**
 * Repository boundary for Class Session Drafts.
 *
 * Per 11_ENV_AND_SETUP.md: "For early UI vertical slice: in-memory/mock
 * repository is acceptable; design repository interface so database can
 * replace it cleanly." This slice ships a localStorage-backed
 * implementation; a Supabase-backed implementation can satisfy the same
 * interface later without touching UI code.
 */
export interface ClassSessionRepository {
  list(): ClassSession[];
  get(id: string): ClassSession | undefined;
  save(session: ClassSession): void;
  remove(id: string): void;
}

const STORAGE_KEY = "ima-yoga-sessions";

function readAll(): Record<string, ClassSession> {
  if (typeof window === "undefined") return {};
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    return raw ? (JSON.parse(raw) as Record<string, ClassSession>) : {};
  } catch {
    return {};
  }
}

function writeAll(sessions: Record<string, ClassSession>): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(sessions));
  } catch {
    // Storage unavailable (private mode, quota) — fail silently; the
    // in-memory React state still reflects the user's edits for this tab.
  }
}

export const localClassSessionRepository: ClassSessionRepository = {
  list() {
    return Object.values(readAll()).sort((a, b) =>
      b.updatedAt.localeCompare(a.updatedAt),
    );
  },
  get(id) {
    return readAll()[id];
  },
  save(session) {
    const all = readAll();
    all[session.id] = session;
    writeAll(all);
  },
  remove(id) {
    const all = readAll();
    delete all[id];
    writeAll(all);
  },
};
