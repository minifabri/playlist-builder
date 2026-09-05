import type {
  ClassPhase,
  EnergyCurve,
  NormalizedEnergyPoint,
  NormalizedPhase,
} from "@/domain/energy/types";

export type ClassType =
  | "slow_flow"
  | "ashtanga"
  | "strength"
  | "flexibility"
  | "foundations"
  | "custom";

export type ClassTypePreset = {
  type: ClassType;
  label: string;
  description: string;
  normalizedPoints: NormalizedEnergyPoint[];
  normalizedPhases: NormalizedPhase[];
};

export type SessionStatus = "setup" | "draft" | "ready" | "exported";

export type MusicIntent = {
  familiarity: number; // 0 discovery .. 100 familiar
  vocals: number; // 0 instrumental .. 100 vocal
  organicElectronic: number; // 0 organic .. 100 electronic
  drive: number; // 0 soft .. 100 driving
  seedArtistNames: string[];
  moodTags: string[];
};

export const DEFAULT_MUSIC_INTENT: MusicIntent = {
  familiarity: 60,
  vocals: 50,
  organicElectronic: 30,
  drive: 50,
  seedArtistNames: [],
  moodTags: [],
};

/** Local, mock-repository representation of a Class Session Draft. */
export type ClassSession = {
  id: string;
  title: string;
  classType: ClassType;
  durationSec: number;
  status: SessionStatus;
  curve: EnergyCurve;
  phases: ClassPhase[];
  musicIntent: MusicIntent;
  createdAt: string;
  updatedAt: string;
};

export const DURATION_PRESETS_MIN = [45, 60, 70, 75, 90] as const;
