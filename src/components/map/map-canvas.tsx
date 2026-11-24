"use client";

import type Konva from "konva";
import { Grid3x3, Maximize, Minus, Plus } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import { Image as KImage, Layer, Rect, Stage } from "react-konva";
import { Button } from "@/components/ui/button";
import { MINIMAP_SIZE, minimapToWorld } from "@/lib/coords";
import type { MapId } from "@/lib/maps";
import type { Scene } from "@/lib/scene";
import type { MinimapAsset } from "@/lib/types";
import { useExplorer } from "@/store/explorer";
import type { HeatGrid } from "@/lib/heatmap";
import { CalibrationLayer } from "./calibration-layer";
import { HeatLayer } from "./heat-layer";
import { HoverCard } from "./hover-card";
import { JourneysLayer } from "./journeys-layer";
import { MarkersLayer } from "./markers-layer";
import { useHtmlImage } from "./use-html-image";

export interface MapCanvasProps {
  mapId: MapId;
  asset: MinimapAsset;
  scene: Scene;
  /** Match seconds; everything up to this time is drawn. */
  time: number;
  heat: { grid: HeatGrid; opacity: number } | null;
  calibration: boolean;
  onToggleCalibration: () => void;
}

const WHEEL_STEP = 1.15;

export default function MapCanvas({
  mapId,
  asset,
  scene,
  time,
  heat,
  calibration,
  onToggleCalibration,
}: MapCanvasProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const stageRef = useRef<Konva.Stage>(null);
  const { size, view, setSize, setView, fit, zoomBy, setStage } = useExplorer();
  const hover = useExplorer((s) => s.hover);
  const focus = useExplorer((s) => s.focus);
  const setHover = useExplorer((s) => s.setHover);

  // A hovered event marker highlights the journey it belongs to.
  const hoveredEvent =
    hover?.kind === "event" ? scene.events.find((e) => e.key === hover.key) : undefined;
  const highlight =
    focus ??
    (hover ? (hover.kind === "journey" ? hover.key : (hoveredEvent?.journeyKey ?? null)) : null);

  const onJourneyHover = useCallback(
    (key: string | null, p?: { x: number; y: number }) =>
      setHover(key && p ? { kind: "journey", key, x: p.x, y: p.y } : null),
    [setHover],
  );
  const onEventHover = useCallback(
    (key: string | null, p?: { x: number; y: number }) =>
      setHover(key && p ? { kind: "event", key, x: p.x, y: p.y } : null),
    [setHover],
  );
  // Pointer over anything with a hover card; otherwise the container's grab cursor shows.
  const hovering = hover !== null;
  useEffect(() => {
    const el = stageRef.current?.container();
    if (el) el.style.cursor = hovering ? "pointer" : "";
  }, [hovering]);
  // Selection changes can remove whatever was hovered.
  useEffect(() => setHover(null), [scene, setHover]);

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

  // The Stage only mounts once the container has a size, so register it then.
  const hasSize = size.w > 0;
  useEffect(() => {
    setStage(stageRef.current);
    return () => setStage(null);
  }, [setStage, hasSize]);

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

  // Cursor readout for the calibration overlay: screen -> minimap -> world.
  const [cursor, setCursor] = useState<{ px: number; py: number; x: number; z: number } | null>(
    null,
  );
  const onPointerMove = useCallback(
    (e: Konva.KonvaEventObject<MouseEvent>) => {
      const p = e.target.getStage()?.getPointerPosition();
      if (!p) return;
      const px = (p.x - view.x) / view.scale;
      const py = (p.y - view.y) / view.scale;
      setCursor({ px, py, ...minimapToWorld(px, py, mapId) });
    },
    [view, mapId],
  );

  return (
    <div
      ref={containerRef}
      className="relative h-full w-full cursor-grab overflow-hidden bg-[#07080a] active:cursor-grabbing"
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
          onMouseMove={calibration ? onPointerMove : undefined}
          onMouseLeave={() => setCursor(null)}
        >
          <Layer listening={false}>
            <Rect width={MINIMAP_SIZE} height={MINIMAP_SIZE} fill="#000" />
            {image && <KImage image={image} width={MINIMAP_SIZE} height={MINIMAP_SIZE} />}
          </Layer>
          {heat && <HeatLayer grid={heat.grid} opacity={heat.opacity} />}
          {calibration && <CalibrationLayer mapId={mapId} scale={view.scale} />}
          <JourneysLayer
            journeys={scene.journeys}
            time={time}
            scale={view.scale}
            highlight={highlight}
            onHover={onJourneyHover}
          />
          <MarkersLayer
            events={scene.events}
            time={time}
            scale={view.scale}
            highlight={highlight}
            onHover={onEventHover}
          />
        </Stage>
      )}

      {hover && <HoverCard hover={hover} scene={scene} bounds={size} />}

      {calibration && cursor && (
        <div className="pointer-events-none absolute bottom-3 left-3 rounded-md border border-border bg-panel/90 px-2.5 py-1.5 font-mono text-xs text-foreground tabular-nums">
          world x {cursor.x.toFixed(1)} · z {cursor.z.toFixed(1)}
          <span className="text-muted">
            {"  "}minimap {cursor.px.toFixed(0)}, {cursor.py.toFixed(0)} / {MINIMAP_SIZE}
          </span>
        </div>
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
        <Button
          size="icon"
          aria-label="Calibration grid"
          title="Calibration grid (G): world-space grid drawn through the same transform as the data"
          active={calibration}
          onClick={onToggleCalibration}
          className="mt-2"
        >
          <Grid3x3 className="h-4 w-4" />
        </Button>
      </div>
    </div>
  );
}
