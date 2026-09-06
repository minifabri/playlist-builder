"use client";

import { useCallback, useMemo, useRef, useState } from "react";
import {
  buildEnergyFunction,
  clampEnergy,
  clampTime,
  energyLabel,
  ENERGY_ZONES,
  MIN_POINT_GAP_SEC,
  type ClassPhase,
  type EnergyCurve,
  type EnergyPoint,
} from "@/domain/energy";

type Props = {
  curve: EnergyCurve;
  phases?: ClassPhase[];
  onChange: (curve: EnergyCurve) => void;
  /** Optional playhead-style marker, e.g. hovered track position. */
  markerSec?: number;
  className?: string;
};

const VIEW_W = 1000;
const VIEW_H = 340;
const MARGIN = { top: 20, right: 24, bottom: 36, left: 90 };
const INNER_W = VIEW_W - MARGIN.left - MARGIN.right;
const INNER_H = VIEW_H - MARGIN.top - MARGIN.bottom;

const ENERGY_ZONE_MIN_OPACITY = 0.03;
const ENERGY_ZONE_MAX_OPACITY = 0.18;

const KEYBOARD_TIME_STEP_SEC = 5;
const KEYBOARD_ENERGY_STEP = 2;
const KEYBOARD_LARGE_MULTIPLIER = 5;

let idCounter = 0;
function newPointId(): string {
  idCounter += 1;
  return `pt-${Date.now().toString(36)}-${idCounter}`;
}

function formatTime(sec: number): string {
  const m = Math.floor(sec / 60);
  const s = Math.round(sec % 60);
  return `${m}:${String(s).padStart(2, "0")}`;
}

export function EnergyCurveEditor({
  curve,
  phases = [],
  onChange,
  markerSec,
  className = "",
}: Props) {
  const svgRef = useRef<SVGSVGElement>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const draggingId = useRef<string | null>(null);

  const xScale = useCallback(
    (t: number) => MARGIN.left + (t / Math.max(curve.durationSec, 1)) * INNER_W,
    [curve.durationSec],
  );
  const yScale = useCallback(
    (e: number) => MARGIN.top + INNER_H - (e / 100) * INNER_H,
    [],
  );
  const xInvert = useCallback(
    (x: number) =>
      ((x - MARGIN.left) / INNER_W) * Math.max(curve.durationSec, 1),
    [curve.durationSec],
  );
  const yInvert = useCallback(
    (y: number) => ((INNER_H - (y - MARGIN.top)) / INNER_H) * 100,
    [],
  );

  const energyAt = useMemo(() => buildEnergyFunction(curve), [curve]);

  const pathD = useMemo(() => {
    const steps = 120;
    let d = "";
    for (let i = 0; i <= steps; i++) {
      const t = (i / steps) * curve.durationSec;
      const x = xScale(t);
      const y = yScale(energyAt(t));
      d += i === 0 ? `M ${x} ${y}` : ` L ${x} ${y}`;
    }
    return d;
  }, [curve.durationSec, energyAt, xScale, yScale]);

  const areaD = useMemo(() => {
    const baseline = yScale(0);
    return `${pathD} L ${xScale(curve.durationSec)} ${baseline} L ${xScale(0)} ${baseline} Z`;
  }, [pathD, xScale, yScale, curve.durationSec]);

  function toSvgPoint(clientX: number, clientY: number) {
    const svg = svgRef.current;
    if (!svg) return { x: 0, y: 0 };
    const rect = svg.getBoundingClientRect();
    const x = ((clientX - rect.left) / rect.width) * VIEW_W;
    const y = ((clientY - rect.top) / rect.height) * VIEW_H;
    return { x, y };
  }

  function updatePoint(id: string, next: Partial<Pick<EnergyPoint, "timeSec" | "energy">>) {
    const isEdge =
      curve.points[0]?.id === id ||
      curve.points[curve.points.length - 1]?.id === id;

    const index = curve.points.findIndex((p) => p.id === id);
    if (index === -1) return;

    const prev = curve.points[index - 1];
    const nextPoint = curve.points[index + 1];

    let timeSec = curve.points[index].timeSec;
    if (!isEdge && next.timeSec !== undefined) {
      const minTime = (prev?.timeSec ?? 0) + MIN_POINT_GAP_SEC;
      const maxTime = (nextPoint?.timeSec ?? curve.durationSec) - MIN_POINT_GAP_SEC;
      timeSec = Math.min(maxTime, Math.max(minTime, next.timeSec));
    }

    const energy =
      next.energy !== undefined ? clampEnergy(next.energy) : curve.points[index].energy;

    const points = curve.points.map((p) =>
      p.id === id ? { ...p, timeSec, energy } : p,
    );
    onChange({ ...curve, points });
  }

  function handlePointerDown(id: string, e: React.PointerEvent) {
    e.currentTarget.setPointerCapture(e.pointerId);
    draggingId.current = id;
    setSelectedId(id);
  }

  function handlePointerMove(e: React.PointerEvent) {
    const id = draggingId.current;
    if (!id) return;
    const { x, y } = toSvgPoint(e.clientX, e.clientY);
    const timeSec = clampTime(xInvert(x), curve.durationSec);
    const energy = clampEnergy(yInvert(y));
    updatePoint(id, { timeSec, energy });
  }

  function handlePointerUp(e: React.PointerEvent) {
    if (draggingId.current) {
      e.currentTarget.releasePointerCapture(e.pointerId);
    }
    draggingId.current = null;
  }

  function handleAddPoint(e: React.MouseEvent) {
    const { x, y } = toSvgPoint(e.clientX, e.clientY);
    const timeSec = clampTime(xInvert(x), curve.durationSec);
    const energy = clampEnergy(yInvert(y));

    const tooClose = curve.points.some(
      (p) => Math.abs(p.timeSec - timeSec) < MIN_POINT_GAP_SEC,
    );
    if (tooClose) return;

    const id = newPointId();
    const points = [...curve.points, { id, timeSec, energy }].sort(
      (a, b) => a.timeSec - b.timeSec,
    );
    onChange({ ...curve, points });
    setSelectedId(id);
  }

  function handleDeletePoint(id: string) {
    const isEdge =
      curve.points[0]?.id === id ||
      curve.points[curve.points.length - 1]?.id === id;
    if (isEdge || curve.points.length <= 2) return;

    onChange({ ...curve, points: curve.points.filter((p) => p.id !== id) });
    setSelectedId(null);
  }

  function handleKeyDown(id: string, e: React.KeyboardEvent) {
    const multiplier = e.shiftKey ? KEYBOARD_LARGE_MULTIPLIER : 1;
    const point = curve.points.find((p) => p.id === id);
    if (!point) return;

    switch (e.key) {
      case "ArrowUp":
        e.preventDefault();
        updatePoint(id, { energy: point.energy + KEYBOARD_ENERGY_STEP * multiplier });
        break;
      case "ArrowDown":
        e.preventDefault();
        updatePoint(id, { energy: point.energy - KEYBOARD_ENERGY_STEP * multiplier });
        break;
      case "ArrowRight":
        e.preventDefault();
        updatePoint(id, { timeSec: point.timeSec + KEYBOARD_TIME_STEP_SEC * multiplier });
        break;
      case "ArrowLeft":
        e.preventDefault();
        updatePoint(id, { timeSec: point.timeSec - KEYBOARD_TIME_STEP_SEC * multiplier });
        break;
      case "Delete":
      case "Backspace":
        e.preventDefault();
        handleDeletePoint(id);
        break;
    }
  }

  const timeTicks = useMemo(() => {
    const count = 6;
    return Array.from({ length: count + 1 }, (_, i) => (curve.durationSec * i) / count);
  }, [curve.durationSec]);

  return (
    <div className={`select-none ${className}`}>
      <svg
        ref={svgRef}
        viewBox={`0 0 ${VIEW_W} ${VIEW_H}`}
        className="w-full h-[280px] sm:h-[340px] touch-none"
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onDoubleClick={handleAddPoint}
        role="img"
        aria-label={`Energy curve over ${Math.round(curve.durationSec / 60)} minutes`}
      >
        {/* Persistent qualitative energy-zone bands (Still/Grounded/Flowing/Driving/Peak) */}
        {ENERGY_ZONES.map((zone, index) => {
          const yTop = yScale(zone.max);
          const yBottom = yScale(zone.min);
          const bandOpacity =
            ENERGY_ZONE_MIN_OPACITY +
            (index / (ENERGY_ZONES.length - 1)) *
              (ENERGY_ZONE_MAX_OPACITY - ENERGY_ZONE_MIN_OPACITY);
          return (
            <g key={zone.label}>
              <rect
                x={MARGIN.left}
                y={yTop}
                width={INNER_W}
                height={yBottom - yTop}
                className="fill-primary"
                style={{ fillOpacity: bandOpacity }}
              />
              <text
                x={MARGIN.left - 12}
                y={(yTop + yBottom) / 2 + 4}
                textAnchor="end"
                className="fill-text-muted text-[11px]"
              >
                {zone.label}
              </text>
            </g>
          );
        })}

        {/* Phase bands */}
        {phases.map((phase) => (
          <g key={phase.id}>
            <rect
              x={xScale(phase.startSec)}
              y={MARGIN.top}
              width={Math.max(0, xScale(phase.endSec) - xScale(phase.startSec))}
              height={INNER_H}
              className="fill-sage/[0.06]"
            />
            <line
              x1={xScale(phase.startSec)}
              x2={xScale(phase.startSec)}
              y1={MARGIN.top}
              y2={MARGIN.top + INNER_H}
              className="stroke-border"
              strokeDasharray="2 4"
            />
            <text
              x={xScale(phase.startSec) + 6}
              y={MARGIN.top + 14}
              className="fill-text-muted text-[10px]"
            >
              {phase.label}
            </text>
          </g>
        ))}

        {/* Horizontal grid + qualitative labels */}
        {[0, 20, 40, 60, 80, 100].map((e) => (
          <g key={e}>
            <line
              x1={MARGIN.left}
              x2={VIEW_W - MARGIN.right}
              y1={yScale(e)}
              y2={yScale(e)}
              className="stroke-border/60"
            />
            <text
              x={MARGIN.left - 8}
              y={yScale(e) + 3}
              textAnchor="end"
              className="fill-text-muted text-[9px]"
            >
              {e}
            </text>
          </g>
        ))}

        {/* Time axis ticks */}
        {timeTicks.map((t) => (
          <text
            key={t}
            x={xScale(t)}
            y={VIEW_H - 10}
            textAnchor="middle"
            className="fill-text-muted text-[10px]"
          >
            {formatTime(t)}
          </text>
        ))}

        {/* Optional playhead marker */}
        {markerSec !== undefined && (
          <line
            x1={xScale(markerSec)}
            x2={xScale(markerSec)}
            y1={MARGIN.top}
            y2={MARGIN.top + INNER_H}
            className="stroke-gold"
            strokeWidth={1.5}
          />
        )}

        {/* Area + curve */}
        <path d={areaD} className="fill-primary/[0.12]" />
        <path d={pathD} className="fill-none stroke-primary" strokeWidth={2.5} />

        {/* Nodes */}
        {curve.points.map((point) => {
          const isSelected = point.id === selectedId;
          return (
            <g
              key={point.id}
              transform={`translate(${xScale(point.timeSec)}, ${yScale(point.energy)})`}
              tabIndex={0}
              role="slider"
              aria-label={`Energy point at ${Math.round(point.timeSec / 60)} minutes, energy ${Math.round(point.energy)} (${energyLabel(point.energy)})`}
              aria-valuemin={0}
              aria-valuemax={100}
              aria-valuenow={Math.round(point.energy)}
              onPointerDown={(e) => handlePointerDown(point.id, e)}
              onKeyDown={(e) => handleKeyDown(point.id, e)}
              onFocus={() => setSelectedId(point.id)}
              className="cursor-grab outline-none active:cursor-grabbing"
            >
              {isSelected && (
                <circle r={11} className="fill-primary/20" />
              )}
              <circle
                r={6}
                className={
                  isSelected
                    ? "fill-primary stroke-white stroke-2"
                    : "fill-surface stroke-primary stroke-2"
                }
              />
            </g>
          );
        })}
      </svg>

      {selectedId && (
        <div className="mt-2 flex items-center justify-between text-xs text-text-muted">
          <span>
            {(() => {
              const p = curve.points.find((pt) => pt.id === selectedId);
              if (!p) return null;
              return `${formatTime(p.timeSec)} · ${Math.round(p.energy)} (${energyLabel(p.energy)})`;
            })()}
          </span>
          <button
            type="button"
            onClick={() => handleDeletePoint(selectedId)}
            className="text-danger hover:underline disabled:opacity-40 disabled:hover:no-underline"
            disabled={
              curve.points[0]?.id === selectedId ||
              curve.points[curve.points.length - 1]?.id === selectedId ||
              curve.points.length <= 2
            }
          >
            Delete point
          </button>
        </div>
      )}
      <p className="mt-1 text-[11px] text-text-muted">
        Double-click the curve to add a point. Drag a node, or select it and use arrow keys
        (Shift for larger steps).
      </p>
    </div>
  );
}
