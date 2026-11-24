import { CASING, EVENT_STYLES } from "@/lib/colors";
import type { EventType } from "@/lib/types";

/** SVG twin of the canvas glyphs, so legend and filters match the map exactly. */
export function MarkerIcon({ type, size = 14 }: { type: EventType; size?: number }) {
  const { color, shape } = EVENT_STYLES[type];
  return (
    <svg width={size} height={size} viewBox="-8 -8 16 16" aria-hidden className="shrink-0">
      {shape === "triangle" && (
        <polygon points="0,-7 6.06,3.5 -6.06,3.5" fill={color} stroke={CASING} strokeWidth={1.5} />
      )}
      {shape === "diamond" && (
        <polygon
          points="0,-7.5 7.5,0 0,7.5 -7.5,0"
          fill={color}
          stroke={CASING}
          strokeWidth={1.5}
        />
      )}
      {shape === "circle" && <circle r={3.5} fill={color} stroke={CASING} strokeWidth={1.25} />}
      {shape === "cross" && (
        <g strokeLinecap="round">
          <path d="M-5-5L5 5M-5 5L5-5" stroke={CASING} strokeWidth={5} />
          <path d="M-5-5L5 5M-5 5L5-5" stroke={color} strokeWidth={2.5} />
        </g>
      )}
    </svg>
  );
}

export function PathSwatch({
  color,
  dashed,
  width = 22,
}: {
  color: string;
  dashed?: boolean;
  width?: number;
}) {
  return (
    <svg width={width} height={8} aria-hidden className="shrink-0">
      <line
        x1={1}
        y1={4}
        x2={width - 1}
        y2={4}
        stroke={CASING}
        strokeWidth={5}
        strokeLinecap="round"
      />
      <line
        x1={1}
        y1={4}
        x2={width - 1}
        y2={4}
        stroke={color}
        strokeWidth={2.25}
        strokeLinecap="round"
        strokeDasharray={dashed ? "5 3" : undefined}
      />
    </svg>
  );
}
