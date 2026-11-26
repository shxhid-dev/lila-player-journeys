"use client";

import { memo } from "react";
import { Circle, Group, Layer, Line, RegularPolygon } from "react-konva";
import { CASING, EVENT_STYLES } from "@/lib/colors";
import type { SceneEvent } from "@/lib/scene";

interface MarkersLayerProps {
  events: SceneEvent[];
  time: number;
  scale: number;
  highlight: string | null;
  /** Off during playback: skips redrawing the hit canvas on every frame. */
  interactive?: boolean;
  onHover?: (key: string | null, pointer?: { x: number; y: number }) => void;
  /** Click or tap a marker to scrub playback to that event. */
  onSeek?: (t: number) => void;
}

/**
 * Event glyphs, drawn in screen pixels: each marker group is scaled by 1/zoom, so
 * markers keep the same on-screen size at any zoom and never swamp the map.
 */
function Glyph({ type }: { type: SceneEvent["type"] }) {
  const { color, shape } = EVENT_STYLES[type];
  switch (shape) {
    case "triangle":
      return <RegularPolygon sides={3} radius={7} fill={color} stroke={CASING} strokeWidth={1.5} />;
    case "diamond":
      return (
        <RegularPolygon sides={4} radius={7.5} fill={color} stroke={CASING} strokeWidth={1.5} />
      );
    case "circle":
      return <Circle radius={3.5} fill={color} stroke={CASING} strokeWidth={1.25} />;
    case "cross":
      return (
        <>
          <Line points={[-5, -5, 5, 5]} stroke={CASING} strokeWidth={5} lineCap="round" />
          <Line points={[-5, 5, 5, -5]} stroke={CASING} strokeWidth={5} lineCap="round" />
          <Line points={[-5, -5, 5, 5]} stroke={color} strokeWidth={2.5} lineCap="round" />
          <Line points={[-5, 5, 5, -5]} stroke={color} strokeWidth={2.5} lineCap="round" />
        </>
      );
  }
}

export const MarkersLayer = memo(function MarkersLayer({
  events,
  time,
  scale,
  highlight,
  interactive = true,
  onHover,
  onSeek,
}: MarkersLayerProps) {
  const inv = 1 / scale;
  return (
    <Layer listening={interactive}>
      {events.map((e) => {
        if (e.t > time) return null;
        const dimmed = highlight !== null && highlight !== e.journeyKey;
        return (
          <Group
            key={e.key}
            x={e.px}
            y={e.py}
            scaleX={inv}
            scaleY={inv}
            opacity={dimmed ? 0.2 : e.ownerKind === "bot" ? 0.75 : 1}
            onMouseEnter={(ev) =>
              onHover?.(e.key, ev.target.getStage()?.getPointerPosition() ?? undefined)
            }
            onMouseLeave={() => onHover?.(null)}
            onClick={() => onSeek?.(e.t)}
            onTap={(ev) => {
              // Touch: jump there and show the card, since there was no hover to see it.
              onSeek?.(e.t);
              onHover?.(e.key, ev.target.getStage()?.getPointerPosition() ?? undefined);
            }}
          >
            <Glyph type={e.type} />
          </Group>
        );
      })}
    </Layer>
  );
});
