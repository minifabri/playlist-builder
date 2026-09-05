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
