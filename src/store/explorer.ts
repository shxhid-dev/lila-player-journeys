"use client";

import type Konva from "konva";
import { create } from "zustand";
import { MINIMAP_SIZE } from "@/lib/coords";
import { clamp } from "@/lib/utils";

/** Transient UI state. Anything shareable lives in the URL instead (see url-state.ts). */

export interface Viewport {
  /** Screen pixels per minimap pixel. */
  scale: number;
  x: number;
  y: number;
}

export interface Hover {
  kind: "journey" | "event";
  key: string;
  x: number;
  y: number;
}

interface ExplorerState {
  size: { w: number; h: number };
  view: Viewport;
  /** True once the user pans or zooms; until then the map refits on resize. */
  userMoved: boolean;
  stage: Konva.Stage | null;
  /** Journeys the user switched off in the player list, by journeyKey. */
  hidden: ReadonlySet<string>;
  /** What the pointer is over on the canvas, with its screen position. */
  hover: Hover | null;
  /** Journey emphasised from the player list (hovering a row). */
  focus: string | null;
  /** Playback clock in match seconds. Live while playing; mirrored to the URL when paused. */
  time: number;
  playing: boolean;
  speed: number;

  setTime: (t: number) => void;
  setPlaying: (playing: boolean) => void;
  setSpeed: (speed: number) => void;

  toggleHidden: (key: string) => void;
  setHover: (hover: Hover | null) => void;
  setFocus: (key: string | null) => void;
  setSize: (w: number, h: number) => void;
  setView: (view: Viewport, byUser?: boolean) => void;
  fit: () => void;
  zoomBy: (factor: number, center?: { x: number; y: number }) => void;
  /** Frame a minimap-space box, e.g. one player's whole path. */
  fitBounds: (bounds: Bounds) => void;
  setStage: (stage: Konva.Stage | null) => void;
}

const FIT_MARGIN = 0.96;
export const MIN_ZOOM = 0.5; // relative to fit
export const MAX_ZOOM = 24;

export function fitViewport(w: number, h: number): Viewport {
  const scale = (Math.min(w, h) / MINIMAP_SIZE) * FIT_MARGIN;
  return { scale, x: (w - MINIMAP_SIZE * scale) / 2, y: (h - MINIMAP_SIZE * scale) / 2 };
}

export const useExplorer = create<ExplorerState>((set, get) => ({
  size: { w: 0, h: 0 },
  view: { scale: 1, x: 0, y: 0 },
  userMoved: false,
  stage: null,
  hidden: new Set(),
  hover: null,
  focus: null,
  time: 0,
  playing: false,
  speed: 4,

  setTime: (time) => set({ time: Math.max(0, time) }),
  setPlaying: (playing) => set({ playing }),
  setSpeed: (speed) => set({ speed }),

  setHover: (hover) => set({ hover }),
  setFocus: (focus) => set({ focus }),
  toggleHidden: (key) => {
    const hidden = new Set(get().hidden);
    if (hidden.has(key)) hidden.delete(key);
    else hidden.add(key);
    // A hidden player can't stay emphasised, or every other path would sit dimmed.
    set({ hidden, focus: get().focus === key ? null : get().focus });
  },
  setSize: (w, h) => {
    const { userMoved } = get();
    set(userMoved ? { size: { w, h } } : { size: { w, h }, view: fitViewport(w, h) });
  },
  setView: (view, byUser = true) => set({ view, userMoved: byUser || get().userMoved }),
  fit: () => {
    const { w, h } = get().size;
    set({ view: fitViewport(w, h), userMoved: false });
  },
  zoomBy: (factor, center) => {
    const { view, size } = get();
    const fit = fitViewport(size.w, size.h).scale;
    const scale = clamp(view.scale * factor, fit * MIN_ZOOM, fit * MAX_ZOOM);
    const c = center ?? { x: size.w / 2, y: size.h / 2 };
    // Keep the map point under `c` fixed while scaling.
    const mx = (c.x - view.x) / view.scale;
    const my = (c.y - view.y) / view.scale;
    set({ view: { scale, x: c.x - mx * scale, y: c.y - my * scale }, userMoved: true });
  },
  fitBounds: (b) => {
    const { size } = get();
    set({ view: viewportForBounds(b, size.w, size.h), userMoved: true });
  },
  setStage: (stage) => set({ stage }),
}));

export interface Bounds {
  minX: number;
  minY: number;
  maxX: number;
  maxY: number;
}

/**
 * Viewport that frames a minimap-space box with padding, centred, within the zoom
 * limits. A tiny box (a player who barely moved) is padded so it doesn't zoom to max.
 */
export function viewportForBounds(b: Bounds, w: number, h: number, padPx = 48): Viewport {
  const fit = fitViewport(w, h).scale;
  const MIN_SPAN = 60; // minimap px
  const bw = Math.max(b.maxX - b.minX, MIN_SPAN);
  const bh = Math.max(b.maxY - b.minY, MIN_SPAN);
  const availW = Math.max(w - padPx * 2, 1);
  const availH = Math.max(h - padPx * 2, 1);
  const scale = clamp(Math.min(availW / bw, availH / bh), fit * MIN_ZOOM, fit * MAX_ZOOM);
  const cx = (b.minX + b.maxX) / 2;
  const cy = (b.minY + b.maxY) / 2;
  return { scale, x: w / 2 - cx * scale, y: h / 2 - cy * scale };
}
