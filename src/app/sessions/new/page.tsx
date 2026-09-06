"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Button } from "@/components/ui/Button";
import { MiniCurvePreview } from "@/components/energy-editor/MiniCurvePreview";
import { CLASS_TYPE_ORDER, CLASS_TYPE_PRESETS } from "@/domain/class-session/presets";
import { DURATION_PRESETS_MIN } from "@/domain/class-session/types";
import type { ClassType } from "@/domain/class-session/types";
import { createSessionFromPreset } from "@/domain/class-session/createSession";
import { localClassSessionRepository } from "@/domain/class-session/repository";

export default function NewSessionPage() {
  const router = useRouter();
  const [classType, setClassType] = useState<ClassType>("slow_flow");
  const [durationMin, setDurationMin] = useState<number>(60);
  const [customDuration, setCustomDuration] = useState<string>("");
  const [title, setTitle] = useState("");

  const preset = CLASS_TYPE_PRESETS[classType];

  const effectiveDurationMin = useMemo(() => {
    const custom = Number(customDuration);
    return customDuration && custom > 0 ? custom : durationMin;
  }, [customDuration, durationMin]);

  function handleSubmit() {
    const session = createSessionFromPreset(
      classType,
      Math.round(effectiveDurationMin * 60),
      title,
    );
    localClassSessionRepository.save(session);
    router.push(`/sessions/${session.id}`);
  }

  return (
    <div className="flex flex-1 flex-col">
      <header className="flex items-center gap-3 px-6 py-5 sm:px-10">
        <Link href="/" className="text-sm text-text-muted hover:text-text">
          ← Back
        </Link>
      </header>

      <main className="mx-auto w-full max-w-3xl flex-1 px-6 pb-16 sm:px-10">
        <h1 className="text-2xl font-semibold text-text">New class</h1>
        <p className="mt-1 text-sm text-text-muted">
          Pick a starting arc — every preset is fully editable afterwards.
        </p>

        <div className="mt-8 grid gap-3 sm:grid-cols-2">
          {CLASS_TYPE_ORDER.map((type) => {
            const p = CLASS_TYPE_PRESETS[type];
            const selected = type === classType;
            return (
              <button
                key={type}
                type="button"
                onClick={() => setClassType(type)}
                className={`rounded-[var(--radius-card)] border p-4 text-left transition-colors ${
                  selected
                    ? "border-primary bg-primary-soft"
                    : "border-border bg-surface hover:bg-surface-subtle"
                }`}
              >
                <div className="font-medium text-text">{p.label}</div>
                <p className="mt-1 text-xs text-text-muted line-clamp-2">
                  {p.description}
                </p>
                <MiniCurvePreview points={p.normalizedPoints} className="mt-3" />
              </button>
            );
          })}
        </div>

        <div className="mt-10">
          <label className="text-sm font-medium text-text" id="duration-label">
            Duration
          </label>
          <div className="mt-2 flex flex-wrap gap-2" role="group" aria-labelledby="duration-label">
            {DURATION_PRESETS_MIN.map((min) => (
              <button
                key={min}
                type="button"
                onClick={() => {
                  setDurationMin(min);
                  setCustomDuration("");
                }}
                className={`h-10 rounded-full border px-4 text-sm ${
                  durationMin === min && !customDuration
                    ? "border-primary bg-primary text-white"
                    : "border-border bg-surface text-text hover:bg-surface-subtle"
                }`}
              >
                {min} min
              </button>
            ))}
            <input
              type="number"
              min={10}
              max={180}
              placeholder="Custom"
              value={customDuration}
              onChange={(e) => setCustomDuration(e.target.value)}
              className="h-10 w-24 rounded-full border border-border bg-surface px-4 text-sm text-text"
              aria-label="Custom duration in minutes"
            />
          </div>
        </div>

        <div className="mt-8">
          <label htmlFor="title" className="text-sm font-medium text-text">
            Title <span className="text-text-muted font-normal">(optional)</span>
          </label>
          <input
            id="title"
            type="text"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder={`${preset.label} — ${effectiveDurationMin} min`}
            className="mt-2 h-11 w-full rounded-[var(--radius-control)] border border-border bg-surface px-4 text-sm text-text"
          />
        </div>

        <div className="mt-10 flex flex-wrap items-center gap-4">
          <Button onClick={handleSubmit} disabled={effectiveDurationMin <= 0}>
            Shape the class
          </Button>
          <Link
            href="/sessions/new/import"
            className="text-sm text-text-muted underline hover:text-text"
          >
            Or import an existing Spotify playlist →
          </Link>
        </div>
      </main>
    </div>
  );
}
