import type { NormalizedEnergyPoint } from "@/domain/energy/types";

type Props = {
  points: NormalizedEnergyPoint[];
  className?: string;
};

const W = 160;
const H = 48;

export function MiniCurvePreview({ points, className = "" }: Props) {
  const d = points
    .map((p, i) => {
      const x = p.x * W;
      const y = H - (p.energy / 100) * H;
      return `${i === 0 ? "M" : "L"} ${x.toFixed(1)} ${y.toFixed(1)}`;
    })
    .join(" ");

  return (
    <svg
      viewBox={`0 0 ${W} ${H}`}
      className={`h-12 w-full ${className}`}
      aria-hidden="true"
    >
      <path
        d={`${d} L ${W} ${H} L 0 ${H} Z`}
        className="fill-primary/[0.12]"
      />
      <path d={d} className="fill-none stroke-primary" strokeWidth={2} />
    </svg>
  );
}
