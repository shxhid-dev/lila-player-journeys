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

interface ExplorerState {
  size: { w: number; h: number };
  view: Viewport;
  /** True once the user pans or zooms; until then the map refits on resize. */
  userMoved: boolean;
  stage: Konva.Stage | null;
  /** Journeys the user switched off in the player list, by journeyKey. */
  hidden: ReadonlySet<string>;

  toggleHidden: (key: string) => void;
  setSize: (w: number, h: number) => void;
  setView: (view: Viewport, byUser?: boolean) => void;
  fit: () => void;
  zoomBy: (factor: number, center?: { x: number; y: number }) => void;
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

  toggleHidden: (key) => {
    const hidden = new Set(get().hidden);
    if (hidden.has(key)) hidden.delete(key);
    else hidden.add(key);
    set({ hidden });
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
  setStage: (stage) => set({ stage }),
}));
