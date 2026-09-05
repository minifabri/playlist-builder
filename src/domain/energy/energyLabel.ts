/**
 * Qualitative labels for energy values — UI aids only, not music science.
 * Spec: 03_DESIGN_SYSTEM.md — "Energy visualization".
 */
const ENERGY_LABELS: { max: number; label: string }[] = [
  { max: 20, label: "Still" },
  { max: 40, label: "Grounded" },
  { max: 60, label: "Flowing" },
  { max: 80, label: "Driving" },
  { max: 100, label: "Peak" },
];

export function energyLabel(energy: number): string {
  const found = ENERGY_LABELS.find((band) => energy <= band.max);
  return found?.label ?? "Peak";
}

/** The five labels in energy order, lowest to highest. */
export const ENERGY_LABEL_ORDER: string[] = ENERGY_LABELS.map((b) => b.label);

/**
 * The midpoint energy value of a qualitative band — used when a person
 * (not Spotify — see 08_SPOTIFY_INTEGRATION.md, Audio Features are
 * unavailable) rates how energetic a track feels by picking its label.
 */
export function energyLabelMidpoint(label: string): number {
  const index = ENERGY_LABELS.findIndex((b) => b.label === label);
  if (index === -1) return 50;
  const prevMax = index === 0 ? 0 : ENERGY_LABELS[index - 1].max;
  const max = ENERGY_LABELS[index].max;
  return Math.round((prevMax + max) / 2);
}
