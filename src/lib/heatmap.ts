import { HEAT_RAMP } from "./colors";
import { MINIMAP_SIZE, worldToMinimap } from "./coords";
import type { MapId } from "./maps";
import {
  HEAT_CODES,
  type HeatLayer,
  type HeatPoints,
  type MatchShard,
  type PlayerKind,
} from "./types";

/** Density grid over the canonical minimap. cells[row * n + col] = count. */
export interface HeatGrid {
  n: number;
  cellPx: number;
  cells: Uint32Array;
  total: number;
  /** 99th percentile of non-empty cells; the colour ramp saturates here. */
  p99: number;
}

/** A flat, layer-filtered point list in world units. */
export interface WorldPoints {
  x: ArrayLike<number>;
  z: ArrayLike<number>;
  length: number;
}

export interface HeatFilter {
  layer: HeatLayer;
  players: PlayerKind[];
  /** Indices into Manifest.dates; empty = all. */
  dateIdx: number[];
}

/** Pick the points for one layer from a map's columnar heat file. */
export function selectHeatPoints(points: HeatPoints, f: HeatFilter): WorldPoints {
  const code = HEAT_CODES[f.layer];
  const wantHuman = f.players.includes("human");
  const wantBot = f.players.includes("bot");
  const dates = f.dateIdx.length ? new Set(f.dateIdx) : null;
  const x: number[] = [];
  const z: number[] = [];
  for (let i = 0; i < points.count; i++) {
    if (points.e[i] !== code) continue;
    if (points.k[i] === 0 ? !wantHuman : !wantBot) continue;
    if (dates && !dates.has(points.d[i])) continue;
    x.push(points.x[i]);
    z.push(points.z[i]);
  }
  return { x, z, length: x.length };
}

const LAYER_EVENT: Record<Exclude<HeatLayer, "traffic">, string> = {
  kills: "kill",
  deaths: "death",
  storm: "storm",
  loot: "loot",
};

/** The same layer computed from loaded match shards ("selected matches" scope). */
export function shardHeatPoints(
  shards: MatchShard[],
  layer: HeatLayer,
  players: PlayerKind[],
): WorldPoints {
  const x: number[] = [];
  const z: number[] = [];
  for (const s of shards) {
    for (const j of s.journeys) {
      if (!players.includes(j.kind)) continue;
      if (layer === "traffic") {
        for (let i = 0; i < j.path.length; i += 3) {
          x.push(j.path[i + 1]);
          z.push(j.path[i + 2]);
        }
      } else {
        for (const [, type, ex, ez] of j.events) {
          if (type === LAYER_EVENT[layer]) {
            x.push(ex);
            z.push(ez);
          }
        }
      }
    }
  }
  return { x, z, length: x.length };
}

/** Bin world points into an n x n grid over the minimap. Points outside the box are dropped. */
export function binPoints(points: WorldPoints, mapId: MapId, cellPx: number): HeatGrid {
  const n = Math.round(MINIMAP_SIZE / cellPx);
  const cells = new Uint32Array(n * n);
  let total = 0;
  for (let i = 0; i < points.length; i++) {
    const { px, py } = worldToMinimap(points.x[i], points.z[i], mapId);
    const col = Math.floor(px / cellPx);
    const row = Math.floor(py / cellPx);
    if (col < 0 || row < 0 || col >= n || row >= n) continue;
    cells[row * n + col]++;
    total++;
  }
  const nonEmpty = Array.from(cells.filter((c) => c > 0)).sort((a, b) => a - b);
  const p99 = nonEmpty.length
    ? nonEmpty[Math.min(nonEmpty.length - 1, Math.floor(nonEmpty.length * 0.99))]
    : 0;
  return { n, cellPx, cells, total, p99 };
}

/**
 * Normalised intensity for a cell count: log-scaled (traffic is heavy-tailed) and
 * clipped at the 99th percentile so one hotspot can't wash out everything else.
 */
export function intensity(count: number, p99: number): number {
  if (count <= 0 || p99 <= 0) return 0;
  return Math.min(1, Math.log1p(count) / Math.log1p(p99));
}

function hexToRgb(hex: string): [number, number, number] {
  const v = parseInt(hex.slice(1), 16);
  return [(v >> 16) & 255, (v >> 8) & 255, v & 255];
}

/** 256-entry RGBA lookup: alpha and lightness both rise with intensity. */
function buildPalette(): Uint8ClampedArray {
  const stops = HEAT_RAMP.map(hexToRgb);
  const lut = new Uint8ClampedArray(256 * 4);
  for (let i = 0; i < 256; i++) {
    const f = (i / 255) * (stops.length - 1);
    const a = Math.floor(f);
    const b = Math.min(stops.length - 1, a + 1);
    const w = f - a;
    for (let c = 0; c < 3; c++) lut[i * 4 + c] = stops[a][c] * (1 - w) + stops[b][c] * w;
    // Alpha floor keeps single events visible on the dark minimaps.
    lut[i * 4 + 3] = i === 0 ? 0 : 120 + (i / 255) * 135;
  }
  return lut;
}

/**
 * Render a grid to a canvas (simpleheat technique): splat a soft radial brush per
 * cell with alpha = intensity, then colourise the alpha channel through the ramp.
 */
export function renderHeat(grid: HeatGrid, size = 1024): HTMLCanvasElement {
  const canvas = document.createElement("canvas");
  canvas.width = canvas.height = size;
  const ctx = canvas.getContext("2d", { willReadFrequently: true });
  if (!ctx || grid.total === 0) return canvas;

  const cell = size / grid.n;
  const radius = Math.max(4, cell * 1.4);
  const brush = document.createElement("canvas");
  brush.width = brush.height = Math.ceil(radius * 2);
  const bctx = brush.getContext("2d");
  if (!bctx) return canvas;
  const g = bctx.createRadialGradient(radius, radius, 0, radius, radius, radius);
  g.addColorStop(0, "rgba(0,0,0,1)");
  g.addColorStop(1, "rgba(0,0,0,0)");
  bctx.fillStyle = g;
  bctx.fillRect(0, 0, brush.width, brush.height);

  for (let row = 0; row < grid.n; row++) {
    for (let col = 0; col < grid.n; col++) {
      const c = grid.cells[row * grid.n + col];
      if (!c) continue;
      // Brushes overlap, so keep each one partly transparent; otherwise dense
      // areas saturate and hot zones stop standing out.
      ctx.globalAlpha = 0.12 + 0.55 * intensity(c, grid.p99);
      ctx.drawImage(brush, (col + 0.5) * cell - radius, (row + 0.5) * cell - radius);
    }
  }

  const img = ctx.getImageData(0, 0, size, size);
  const lut = buildPalette();
  const d = img.data;
  for (let i = 0; i < d.length; i += 4) {
    const a = d[i + 3];
    if (!a) continue;
    const j = a * 4;
    d[i] = lut[j];
    d[i + 1] = lut[j + 1];
    d[i + 2] = lut[j + 2];
    d[i + 3] = lut[j + 3];
  }
  ctx.putImageData(img, 0, 0);
  return canvas;
}
