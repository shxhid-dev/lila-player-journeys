"use client";

import { memo, useMemo } from "react";
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
  /** Off during playback: skips redrawing the hit canvas on every frame. */
  interactive?: boolean;
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
            // Screen pixels: strokeScaleEnabled is off, so Konva doesn't scale the dash.
            dash={sj.dashed ? [6, 4] : undefined}
            lineJoin="round"
            lineCap="round"
            strokeScaleEnabled={false}
            // Also screen pixels, for the same reason: a ~14px band at any zoom.
            hitStrokeWidth={14}
            perfectDrawEnabled={false}
            onMouseEnter={(e) =>
              onHover?.(sj.key, e.target.getStage()?.getPointerPosition() ?? undefined)
            }
            onMouseMove={(e) =>
              onHover?.(sj.key, e.target.getStage()?.getPointerPosition() ?? undefined)
            }
            onMouseLeave={() => onHover?.(null)}
            // Touch has no hover, so a tap opens the player card.
            onTap={(e) => onHover?.(sj.key, e.target.getStage()?.getPointerPosition() ?? undefined)}
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
  interactive = true,
  onHover,
}: JourneysLayerProps) {
  // Bots first so human paths always sit on top.
  const ordered = useMemo(
    () =>
      [...journeys].sort(
        (a, b) => Number(a.journey.kind === "human") - Number(b.journey.kind === "human"),
      ),
    [journeys],
  );
  return (
    <Layer listening={interactive}>
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
