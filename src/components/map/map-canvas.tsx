"use client";

import type Konva from "konva";
import { Maximize, Minus, Plus } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import { Image as KImage, Layer, Rect, Stage } from "react-konva";
import { Button } from "@/components/ui/button";
import { MINIMAP_SIZE } from "@/lib/coords";
import type { MapId } from "@/lib/maps";
import type { MinimapAsset } from "@/lib/types";
import { useExplorer } from "@/store/explorer";
import { useHtmlImage } from "./use-html-image";

export interface MapCanvasProps {
  mapId: MapId;
  asset: MinimapAsset;
}

const WHEEL_STEP = 1.15;

export default function MapCanvas({ mapId, asset }: MapCanvasProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const stageRef = useRef<Konva.Stage>(null);
  const { size, view, setSize, setView, fit, zoomBy, setStage } = useExplorer();

  // Track the container size; the store refits until the user takes control.
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const ro = new ResizeObserver(([entry]) => {
      const { width, height } = entry.contentRect;
      setSize(Math.round(width), Math.round(height));
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, [setSize]);

  useEffect(() => {
    setStage(stageRef.current);
    return () => setStage(null);
  }, [setStage]);

  // New map, new framing.
  useEffect(() => {
    fit();
  }, [mapId, fit]);

  // Base image first; the 4096px version loads once the user zooms past its resolution.
  const dpr = typeof window === "undefined" ? 1 : window.devicePixelRatio || 1;
  const wantHi = view.scale * dpr > asset.imageSize / MINIMAP_SIZE;
  const [hiRequested, setHiRequested] = useState(false);
  useEffect(() => {
    if (wantHi) setHiRequested(true);
  }, [wantHi]);
  useEffect(() => setHiRequested(false), [mapId]);
  const base = useHtmlImage(asset.image);
  const hi = useHtmlImage(hiRequested ? asset.imageHi : null);
  const image = hi ?? base;

  const onWheel = useCallback(
    (e: Konva.KonvaEventObject<WheelEvent>) => {
      e.evt.preventDefault();
      const pointer = e.target.getStage()?.getPointerPosition();
      if (!pointer) return;
      zoomBy(e.evt.deltaY < 0 ? WHEEL_STEP : 1 / WHEEL_STEP, pointer);
    },
    [zoomBy],
  );

  // Two-finger pinch zoom; one finger pans via Konva's stage drag.
  const pinch = useRef<{ dist: number } | null>(null);
  const onTouchMove = useCallback(
    (e: Konva.KonvaEventObject<TouchEvent>) => {
      const [a, b] = Array.from(e.evt.touches);
      if (!a || !b) return;
      e.evt.preventDefault();
      const stage = e.target.getStage();
      stage?.stopDrag();
      const rect = containerRef.current?.getBoundingClientRect();
      if (!rect) return;
      const dist = Math.hypot(a.clientX - b.clientX, a.clientY - b.clientY);
      const center = {
        x: (a.clientX + b.clientX) / 2 - rect.left,
        y: (a.clientY + b.clientY) / 2 - rect.top,
      };
      if (pinch.current) zoomBy(dist / pinch.current.dist, center);
      pinch.current = { dist };
    },
    [zoomBy],
  );

  return (
    <div
      ref={containerRef}
      className="relative h-full w-full overflow-hidden bg-[#07080a]"
      data-testid="map-canvas"
    >
      {size.w > 0 && (
        <Stage
          ref={stageRef}
          width={size.w}
          height={size.h}
          x={view.x}
          y={view.y}
          scaleX={view.scale}
          scaleY={view.scale}
          draggable
          onWheel={onWheel}
          onTouchMove={onTouchMove}
          onTouchEnd={() => (pinch.current = null)}
          onDragEnd={(e) => {
            if (e.target !== e.target.getStage()) return;
            setView({ scale: view.scale, x: e.target.x(), y: e.target.y() });
          }}
        >
          <Layer listening={false}>
            <Rect width={MINIMAP_SIZE} height={MINIMAP_SIZE} fill="#000" />
            {image && <KImage image={image} width={MINIMAP_SIZE} height={MINIMAP_SIZE} />}
          </Layer>
        </Stage>
      )}

      {!base && (
        <div className="pointer-events-none absolute inset-0 grid place-items-center">
          <div className="flex items-center gap-2 text-sm text-muted">
            <span className="h-4 w-4 animate-spin rounded-full border-2 border-muted/40 border-t-accent" />
            Loading minimap…
          </div>
        </div>
      )}

      <div className="absolute top-3 right-3 flex flex-col gap-1">
        <Button size="icon" aria-label="Zoom in" title="Zoom in (+)" onClick={() => zoomBy(1.4)}>
          <Plus className="h-4 w-4" />
        </Button>
        <Button
          size="icon"
          aria-label="Zoom out"
          title="Zoom out (−)"
          onClick={() => zoomBy(1 / 1.4)}
        >
          <Minus className="h-4 w-4" />
        </Button>
        <Button size="icon" aria-label="Reset view" title="Reset view (0)" onClick={fit}>
          <Maximize className="h-4 w-4" />
        </Button>
      </div>
    </div>
  );
}
