"use client";

import { Fragment } from "react";
import { Circle, Group, Layer, Line, Rect, Text } from "react-konva";
import { MINIMAP_SIZE, worldBounds, worldToMinimap } from "@/lib/coords";
import { MAPS, type MapId } from "@/lib/maps";

const GRID = "rgba(245, 184, 61, 0.35)";
const AXIS = "rgba(245, 184, 61, 0.9)";

/** README worked example, drawn so reviewers can check it against the doc. */
const README_EXAMPLE = { map: "AmbroseValley" as MapId, x: -301.45, z: -355.55 };

function ticks(min: number, max: number, step: number) {
  const out: number[] = [];
  for (let v = Math.ceil(min / step) * step; v <= max; v += step) out.push(v);
  return out;
}

/**
 * World-space grid drawn through the same worldToMinimap used for every data point.
 * If the transform were off, these lines would disagree with the minimap's roads and
 * buildings, and with the cursor readout.
 */
export function CalibrationLayer({ mapId, scale }: { mapId: MapId; scale: number }) {
  const b = worldBounds(mapId);
  const step = MAPS[mapId].scale >= 900 ? 100 : 50;
  const inv = 1 / scale;
  const label = (text: string, x: number, y: number, align: "left" | "center" = "left") => (
    <Group x={x} y={y} scaleX={inv} scaleY={inv}>
      <Text
        text={text}
        fontSize={11}
        fontFamily="ui-monospace, monospace"
        fill={AXIS}
        offsetX={align === "center" ? text.length * 3.3 : 0}
        shadowColor="#000"
        shadowBlur={3}
        shadowOpacity={1}
      />
    </Group>
  );

  return (
    <Layer listening={false}>
      <Rect
        width={MINIMAP_SIZE}
        height={MINIMAP_SIZE}
        stroke={AXIS}
        strokeWidth={1.5}
        strokeScaleEnabled={false}
        // With strokeScaleEnabled off, Konva applies the dash in screen pixels.
        dash={[6, 4]}
      />
      {ticks(b.minX, b.maxX, step).map((x) => {
        const { px } = worldToMinimap(x, 0, mapId);
        return (
          <Fragment key={`x${x}`}>
            <Line
              points={[px, 0, px, MINIMAP_SIZE]}
              stroke={x === 0 ? AXIS : GRID}
              strokeWidth={x === 0 ? 1.5 : 1}
              strokeScaleEnabled={false}
            />
            {label(`x ${x}`, px + 3 * inv, 4 * inv)}
          </Fragment>
        );
      })}
      {ticks(b.minZ, b.maxZ, step).map((z) => {
        const { py } = worldToMinimap(0, z, mapId);
        return (
          <Fragment key={`z${z}`}>
            <Line
              points={[0, py, MINIMAP_SIZE, py]}
              stroke={z === 0 ? AXIS : GRID}
              strokeWidth={z === 0 ? 1.5 : 1}
              strokeScaleEnabled={false}
            />
            {label(`z ${z}`, 4 * inv, py + 3 * inv)}
          </Fragment>
        );
      })}
      {label(`origin (${b.minX}, ${b.minZ})`, 4 * inv, MINIMAP_SIZE - 16 * inv)}
      {label(`(${b.maxX}, ${b.maxZ})`, MINIMAP_SIZE - 90 * inv, 18 * inv)}
      {mapId === README_EXAMPLE.map &&
        (() => {
          const p = worldToMinimap(README_EXAMPLE.x, README_EXAMPLE.z, mapId);
          return (
            <>
              <Circle
                x={p.px}
                y={p.py}
                radius={5 * inv}
                stroke={AXIS}
                strokeWidth={2}
                strokeScaleEnabled={false}
              />
              {label(
                `README example → (${p.px.toFixed(0)}, ${p.py.toFixed(0)})`,
                p.px + 8 * inv,
                p.py - 6 * inv,
              )}
            </>
          );
        })()}
    </Layer>
  );
}
