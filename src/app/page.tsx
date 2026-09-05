"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/Button";
import { ThemeToggle } from "@/components/theme/ThemeToggle";
import { localClassSessionRepository } from "@/domain/class-session/repository";
import type { ClassSession } from "@/domain/class-session/types";
import { CLASS_TYPE_PRESETS } from "@/domain/class-session/presets";

export default function Home() {
  const [recent, setRecent] = useState<ClassSession[]>([]);

  useEffect(() => {
    // Reading localStorage (an external system) once after mount — this is
    // the sanctioned useEffect pattern, not a derivable-from-props value.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setRecent(localClassSessionRepository.list().slice(0, 6));
  }, []);

  return (
    <div className="flex flex-1 flex-col">
      <header className="flex items-center justify-between px-6 py-5 sm:px-10">
        <span className="text-sm font-semibold tracking-wide text-text">
          Ima Yoga <span className="text-primary">Playlist Builder</span>
        </span>
        <ThemeToggle />
      </header>

      <main className="mx-auto w-full max-w-3xl flex-1 px-6 py-10 sm:px-10">
        <h1 className="max-w-xl text-3xl font-semibold leading-tight text-text sm:text-4xl">
          Build the musical arc of your class, then let the playlist follow it.
        </h1>
        <p className="mt-3 max-w-lg text-text-muted">
          Design the energy first — arrival, build, peak, release, savasana —
          then shape a coherent sequence around that arc.
        </p>

        <div className="mt-8 flex flex-wrap gap-3">
          <Link href="/sessions/new">
            <Button>Shape a new class</Button>
          </Link>
        </div>

        <section className="mt-14">
          <h2 className="text-sm font-medium text-text-muted">Recent sessions</h2>

          {recent.length === 0 ? (
            <p className="mt-3 text-sm text-text-muted">
              No sessions yet. Create your first class to get started.
            </p>
          ) : (
            <ul className="mt-4 grid gap-3 sm:grid-cols-2">
              {recent.map((session) => (
                <li key={session.id}>
                  <Link
                    href={`/sessions/${session.id}`}
                    className="block rounded-[var(--radius-card)] border border-border bg-surface p-4 transition-colors hover:bg-surface-subtle"
                  >
                    <div className="font-medium text-text">{session.title}</div>
                    <div className="mt-1 text-xs text-text-muted">
                      {CLASS_TYPE_PRESETS[session.classType].label} ·{" "}
                      {Math.round(session.durationSec / 60)} min · {session.status}
                    </div>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </section>
      </main>
    </div>
  );
}
