import {
  applyCurveToDuration,
  applyPhasesToDuration,
} from "@/domain/energy/scaleCurve";
import { CLASS_TYPE_PRESETS } from "./presets";
import { DEFAULT_MUSIC_INTENT, type ClassSession, type ClassType } from "./types";

function newId(): string {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID();
  }
  return `session-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}

export function createSessionFromPreset(
  classType: ClassType,
  durationSec: number,
  title?: string,
): ClassSession {
  const preset = CLASS_TYPE_PRESETS[classType];
  const now = new Date().toISOString();

  return {
    id: newId(),
    title: title?.trim() || `${preset.label} — ${Math.round(durationSec / 60)} min`,
    classType,
    durationSec,
    status: "setup",
    curve: applyCurveToDuration(preset.normalizedPoints, durationSec),
    phases: applyPhasesToDuration(preset.normalizedPhases, durationSec),
    musicIntent: { ...DEFAULT_MUSIC_INTENT },
    createdAt: now,
    updatedAt: now,
  };
}
