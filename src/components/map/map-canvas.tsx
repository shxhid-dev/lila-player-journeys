"use client";

import type Konva from "konva";
import { Grid3x3, Maximize, Minus, Plus } from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Image as KImage, Layer, Rect, Stage } from "react-konva";
import { Button } from "@/components/ui/button";
import { MINIMAP_SIZE, minimapToWorld } from "@/lib/coords";
import type { HeatGrid } from "@/lib/heatmap";
import { MAPS, type MapId } from "@/lib/maps";
import type { Scene } from "@/lib/scene";
import type { MinimapAsset } from "@/lib/types";
import { useExplorer } from "@/store/explorer";
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
  heat: { grid: HeatGrid; opacity: number } | null;
  /** Shown over the map when the current settings draw nothing. */
  hint?: string | null;
  calibration: boolean;
  onToggleCalibration: () => void;
}

const WHEEL_STEP = 1.15;

/** Largest value in ascending `sorted` that is <= t, or -1 if none. */
function latestAtOrBefore(sorted: number[], t: number): number {
  let lo = 0;
  let hi = sorted.length - 1;
  let ans = -1;
  while (lo <= hi) {
    const mid = (lo + hi) >> 1;
    if (sorted[mid] <= t) {
      ans = sorted[mid];
      lo = mid + 1;
    } else hi = mid - 1;
  }
  return ans;
}

export default function MapCanvas({
  mapId,
  asset,
  scene,
  heat,
  hint,
  calibration,
  onToggleCalibration,
}: MapCanvasProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const stageRef = useRef<Konva.Stage>(null);
  // Narrow subscriptions: the playback clock ticks the store ~60 times a second.
  const size = useExplorer((s) => s.size);
  const view = useExplorer((s) => s.view);
  // The playback clock (match seconds): everything up to this moment is drawn.
  const time = useExplorer((s) => s.time);
  const playing = useExplorer((s) => s.playing);
  const hover = useExplorer((s) => s.hover);
  const focus = useExplorer((s) => s.focus);
  const { setSize, setView, fit, zoomBy, setStage, setHover } = useExplorer.getState();

  // A hovered event marker highlights the journey it belongs to. Keys that are no
  // longer drawn (hidden player, other match, filtered out) never dim the map.
  const drawnKeys = useMemo(() => new Set(scene.journeys.map((j) => j.key)), [scene.journeys]);
  const hoveredEvent =
    hover?.kind === "event" ? scene.events.find((e) => e.key === hover.key) : undefined;
  const candidate =
    focus ??
    (hover ? (hover.kind === "journey" ? hover.key : (hoveredEvent?.journeyKey ?? null)) : null);
  const highlight = candidate && drawnKeys.has(candidate) ? candidate : null;

  // Markers only change when playback crosses an event, so feed the layer the time of
  // the latest event reached rather than the raw clock. It then re-renders per event,
  // not per frame.
  const eventTimes = useMemo(
    () => [...new Set(scene.events.map((e) => e.t))].sort((a, b) => a - b),
    [scene.events],
  );
  const markerTime = latestAtOrBefore(eventTimes, time);

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
  const onSeek = useCallback((t: number) => {
    const { setPlaying, setTime } = useExplorer.getState();
    setPlaying(false);
    setTime(t);
  }, []);

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
  // Remember which map asked for high-res, so switching maps never starts a download
  // of the next map's 4096px image before the view has been refit.
  const [hiFor, setHiFor] = useState<MapId | null>(null);
  useEffect(() => {
    if (wantHi) setHiFor(mapId);
  }, [wantHi, mapId]);
  const base = useHtmlImage(asset.image);
  const hi = useHtmlImage(hiFor === mapId ? asset.imageHi : null);
  const image = hi.image ?? base.image;
  // Data layers wait for the minimap so paths never float on an empty canvas.
  // If the image fails, the data is still drawn and a notice explains the blank map.
  const mapReady = base.status !== "loading";

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
          // Touch has no hover: tapping empty map dismisses an open card.
          onTap={(e) => e.target === e.target.getStage() && setHover(null)}
        >
          <Layer listening={false}>
            <Rect width={MINIMAP_SIZE} height={MINIMAP_SIZE} fill="#000" />
            {image && <KImage image={image} width={MINIMAP_SIZE} height={MINIMAP_SIZE} />}
          </Layer>
          {mapReady && heat && <HeatLayer grid={heat.grid} opacity={heat.opacity} />}
          {calibration && <CalibrationLayer mapId={mapId} scale={view.scale} />}
          {mapReady && (
            <JourneysLayer
              journeys={scene.journeys}
              time={time}
              scale={view.scale}
              highlight={highlight}
              interactive={!playing}
              onHover={onJourneyHover}
            />
          )}
          {mapReady && (
            <MarkersLayer
              events={scene.events}
              time={markerTime}
              scale={view.scale}
              highlight={highlight}
              interactive={!playing}
              onHover={onEventHover}
              onSeek={onSeek}
            />
          )}
        </Stage>
      )}

      {hover && <HoverCard hover={hover} scene={scene} bounds={size} />}

      {hint && mapReady && (
        <div className="pointer-events-none absolute inset-x-0 top-4 flex justify-center px-16">
          <p
            role="status"
            className="max-w-md rounded-lg border border-border bg-panel/90 px-4 py-2.5 text-center text-sm text-muted shadow-lg backdrop-blur"
          >
            {hint}
          </p>
        </div>
      )}

      {calibration && cursor && (
        <div className="pointer-events-none absolute bottom-3 left-3 rounded-md border border-border bg-panel/90 px-2.5 py-1.5 font-mono text-xs text-foreground tabular-nums">
          world x {cursor.x.toFixed(1)} · z {cursor.z.toFixed(1)}
          <span className="text-muted">
            {"  "}minimap {cursor.px.toFixed(0)}, {cursor.py.toFixed(0)} / {MINIMAP_SIZE}
          </span>
        </div>
      )}

      {base.status === "loading" && (
        <div
          className="pointer-events-none absolute inset-0 grid place-items-center"
          role="status"
          aria-live="polite"
        >
          <div className="flex items-center gap-2 rounded-full border border-border bg-panel/90 px-3 py-1.5 text-sm text-muted">
            <span className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-muted/40 border-t-accent" />
            Loading {MAPS[mapId].label}…
          </div>
        </div>
      )}
      {base.status === "error" && (
        <p
          role="alert"
          className="pointer-events-none absolute bottom-3 left-1/2 -translate-x-1/2 rounded-md border border-border bg-panel/90 px-3 py-1.5 text-xs text-red-300"
        >
          The minimap image didn&apos;t load. Data is drawn on a blank background; try reloading.
        </p>
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
