import type { MockTrack } from "./types";

/**
 * Local mock candidate pool for the Phase 0 vertical slice.
 * Fictional titles/artists — this slice does not call the Spotify API.
 */
export const MOCK_TRACK_POOL: MockTrack[] = [
  { id: "t01", title: "Quiet Horizon", artist: "Halden Grove", durationMs: 210_000, energyEstimate: 8, vocalsLevel: 5 },
  { id: "t02", title: "First Light", artist: "Mira Solen", durationMs: 235_000, energyEstimate: 14, vocalsLevel: 10 },
  { id: "t03", title: "Amber Drift", artist: "Halden Grove", durationMs: 248_000, energyEstimate: 22, vocalsLevel: 15 },
  { id: "t04", title: "Slow Unfold", artist: "Petra Ilo", durationMs: 260_000, energyEstimate: 30, vocalsLevel: 40 },
  { id: "t05", title: "Rising Tide", artist: "Nord Field", durationMs: 275_000, energyEstimate: 42, vocalsLevel: 20 },
  { id: "t06", title: "Open Ground", artist: "Mira Solen", durationMs: 255_000, energyEstimate: 48, vocalsLevel: 55 },
  { id: "t07", title: "Momentum", artist: "Corax Low", durationMs: 220_000, energyEstimate: 58, vocalsLevel: 30 },
  { id: "t08", title: "Pulse Line", artist: "Corax Low", durationMs: 205_000, energyEstimate: 68, vocalsLevel: 35 },
  { id: "t09", title: "Bright Current", artist: "Nord Field", durationMs: 232_000, energyEstimate: 76, vocalsLevel: 45 },
  { id: "t10", title: "Peak Hour", artist: "Vela Ren", durationMs: 218_000, energyEstimate: 84, vocalsLevel: 50 },
  { id: "t11", title: "Full Stride", artist: "Vela Ren", durationMs: 240_000, energyEstimate: 88, vocalsLevel: 60 },
  { id: "t12", title: "Coming Down", artist: "Petra Ilo", durationMs: 265_000, energyEstimate: 46, vocalsLevel: 25 },
  { id: "t13", title: "Soft Landing", artist: "Nord Field", durationMs: 250_000, energyEstimate: 28, vocalsLevel: 12 },
  { id: "t14", title: "Long Exhale", artist: "Mira Solen", durationMs: 290_000, energyEstimate: 15, vocalsLevel: 8 },
  { id: "t15", title: "Still Room", artist: "Halden Grove", durationMs: 310_000, energyEstimate: 6, vocalsLevel: 3 },
  { id: "t16", title: "Even Ground", artist: "Petra Ilo", durationMs: 245_000, energyEstimate: 36, vocalsLevel: 42 },
];
