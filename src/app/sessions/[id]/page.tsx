"use client";

import { use, useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
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
import type { OrderedTrack } from "@/domain/playlist/calculatePlacements";
import { generateMockDraft } from "@/domain/playlist/generateMockDraft";

const AUTOSAVE_DELAY_MS = 700;

export default function SessionEditorPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  const [session, setSession] = useState<ClassSession | null | undefined>(
    undefined,
  );
  const [order, setOrder] = useState<OrderedTrack[]>([]);
  const [savedState, setSavedState] = useState<"saved" | "saving">("saved");
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    const found = localClassSessionRepository.get(id);
    // Reading localStorage (an external system) once after mount.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setSession(found ?? null);

    if (typeof window !== "undefined") {
      try {
        const raw = window.localStorage.getItem(`ima-yoga-tracks-${id}`);
        if (raw) setOrder(JSON.parse(raw) as OrderedTrack[]);
      } catch {
        // ignore
      }
    }
  }, [id]);

  const scheduleSave = useCallback(
    (next: ClassSession, nextOrder: OrderedTrack[]) => {
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

  function updateOrder(next: OrderedTrack[]) {
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
          <Button size="sm" disabled title="Spotify export is not wired up in this vertical slice">
            Export to Spotify
          </Button>
          <ThemeToggle />
        </div>
      </header>

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
            <TrackRail order={order} curve={session.curve} onChange={updateOrder} />
          </section>
        </div>

        <aside className="space-y-6">
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
            <p className="mt-4 text-[11px] text-text-muted">
              Seed artists and Spotify search are not wired up in this
              vertical slice — see 08_SPOTIFY_INTEGRATION.md for the next
              phase.
            </p>
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
