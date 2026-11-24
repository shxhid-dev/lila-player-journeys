"use client";

import { memo } from "react";
import { Circle, Group, Layer, Line } from "react-konva";
import { CASING } from "@/lib/colors";
import { pathUntil, positionAt } from "@/lib/journey";
import type { SceneJourney } from "@/lib/scene";

interface JourneysLayerProps {
  journeys: SceneJourney[];
  time: number;
  /** Screen px per map px, so dashes and markers keep a constant on-screen size. */
  scale: number;
  highlight: string | null;
  onHover?: (key: string | null, pointer?: { x: number; y: number }) => void;
}

const HUMAN_WIDTH = 2.25;
const BOT_WIDTH = 1.5;

function JourneyPath({
  sj,
  time,
  scale,
  dimmed,
  emphasized,
  onHover,
}: {
  sj: SceneJourney;
  time: number;
  scale: number;
  dimmed: boolean;
  emphasized: boolean;
  onHover?: JourneysLayerProps["onHover"];
}) {
  const points = pathUntil(sj.projected, time);
  const head = time < sj.journey.end ? positionAt(sj.projected, time) : null;
  const ended = time >= sj.journey.end;
  const isHuman = sj.journey.kind === "human";
  const width = (isHuman ? HUMAN_WIDTH : BOT_WIDTH) * (emphasized ? 1.6 : 1);
  const inv = 1 / scale;
  const opacity = dimmed ? 0.18 : isHuman ? 1 : 0.85;
  const last = sj.projected.points.length;

  return (
    <Group opacity={opacity}>
      {points.length >= 4 && (
        <>
          <Line
            points={points}
            stroke={CASING}
            strokeWidth={width + 2.5}
            opacity={isHuman ? 0.65 : 0.9}
            lineJoin="round"
            lineCap="round"
            strokeScaleEnabled={false}
            listening={false}
            perfectDrawEnabled={false}
          />
          <Line
            points={points}
            stroke={sj.color}
            strokeWidth={width}
            dash={sj.dashed ? [6 * inv, 4 * inv] : undefined}
            lineJoin="round"
            lineCap="round"
            strokeScaleEnabled={false}
            hitStrokeWidth={14 * inv}
            perfectDrawEnabled={false}
            onMouseEnter={(e) =>
              onHover?.(sj.key, e.target.getStage()?.getPointerPosition() ?? undefined)
            }
            onMouseMove={(e) =>
              onHover?.(sj.key, e.target.getStage()?.getPointerPosition() ?? undefined)
            }
            onMouseLeave={() => onHover?.(null)}
          />
        </>
      )}
      {/* Spawn: small hollow dot where the journey's telemetry begins. */}
      {points.length >= 2 && (
        <Circle
          x={sj.projected.points[0]}
          y={sj.projected.points[1]}
          radius={3 * inv}
          stroke={sj.color}
          strokeWidth={1.5}
          strokeScaleEnabled={false}
          fill={CASING}
          listening={false}
        />
      )}
      {/* Last seen alive: a ring where a survivor's telemetry stops (extracted or left). */}
      {ended && sj.journey.outcome === "survived" && last >= 2 && (
        <Circle
          x={sj.projected.points[last - 2]}
          y={sj.projected.points[last - 1]}
          radius={6 * inv}
          stroke={sj.color}
          strokeWidth={2.5}
          strokeScaleEnabled={false}
          shadowColor={CASING}
          shadowBlur={4}
          shadowOpacity={1}
          listening={false}
        />
      )}
      {head && (
        <Circle
          x={head.px}
          y={head.py}
          radius={(isHuman ? 5.5 : 4) * inv}
          fill={sj.color}
          stroke="#fff"
          strokeWidth={1.5}
          strokeScaleEnabled={false}
          listening={false}
        />
      )}
    </Group>
  );
}

export const JourneysLayer = memo(function JourneysLayer({
  journeys,
  time,
  scale,
  highlight,
  onHover,
}: JourneysLayerProps) {
  // Bots first so human paths always sit on top.
  const ordered = [...journeys].sort(
    (a, b) => Number(a.journey.kind === "human") - Number(b.journey.kind === "human"),
  );
  return (
    <Layer>
      {ordered.map((sj) => (
        <JourneyPath
          key={sj.key}
          sj={sj}
          time={time}
          scale={scale}
          dimmed={highlight !== null && highlight !== sj.key}
          emphasized={highlight === sj.key}
          onHover={onHover}
        />
      ))}
    </Layer>
  );
});
