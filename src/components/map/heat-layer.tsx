"use client";

import { useMemo } from "react";
import { Image as KImage, Layer } from "react-konva";
import { MINIMAP_SIZE } from "@/lib/coords";
import { renderHeat, type HeatGrid } from "@/lib/heatmap";

export function HeatLayer({ grid, opacity }: { grid: HeatGrid; opacity: number }) {
  const canvas = useMemo(() => renderHeat(grid), [grid]);
  return (
    <Layer listening={false}>
      <KImage image={canvas} width={MINIMAP_SIZE} height={MINIMAP_SIZE} opacity={opacity} />
    </Layer>
  );
}
