import { worldToMinimap } from "./coords";
import type { MapId } from "./maps";
import type { Journey } from "./types";

export interface ProjectedJourney {
  journey: Journey;
  /** Sample times, ascending. */
  times: number[];
  /** Flat [px, py, ...] in minimap space, parallel to `times`. */
  points: number[];
}

/** Project a journey's world path into minimap space once; playback slices it. */
export function projectJourney(journey: Journey, mapId: MapId): ProjectedJourney {
  const n = journey.path.length / 3;
  const times = new Array<number>(n);
  const points = new Array<number>(n * 2);
  for (let i = 0; i < n; i++) {
    const { px, py } = worldToMinimap(journey.path[i * 3 + 1], journey.path[i * 3 + 2], mapId);
    times[i] = journey.path[i * 3];
    points[i * 2] = px;
    points[i * 2 + 1] = py;
  }
  return { journey, times, points };
}

/** Index of the last sample with time <= t, or -1. */
function lastIndexAtOrBefore(times: number[], t: number): number {
  let lo = 0;
  let hi = times.length - 1;
  let ans = -1;
  while (lo <= hi) {
    const mid = (lo + hi) >> 1;
    if (times[mid] <= t) {
      ans = mid;
      lo = mid + 1;
    } else hi = mid - 1;
  }
  return ans;
}

/**
 * Where the player is at match time t, linearly interpolated between samples.
 * Null before the journey starts or after it ends (dead or left).
 */
export function positionAt(pj: ProjectedJourney, t: number): { px: number; py: number } | null {
  const { times, points, journey } = pj;
  if (!times.length || t < journey.start || t > journey.end) return null;
  const i = lastIndexAtOrBefore(times, t);
  if (i < 0) return { px: points[0], py: points[1] };
  if (i >= times.length - 1) return { px: points[i * 2], py: points[i * 2 + 1] };
  const t0 = times[i];
  const t1 = times[i + 1];
  const f = t1 === t0 ? 0 : (t - t0) / (t1 - t0);
  return {
    px: points[i * 2] + (points[i * 2 + 2] - points[i * 2]) * f,
    py: points[i * 2 + 1] + (points[i * 2 + 3] - points[i * 2 + 1]) * f,
  };
}

/** Polyline up to time t (inclusive), ending at the interpolated position. */
export function pathUntil(pj: ProjectedJourney, t: number): number[] {
  const i = lastIndexAtOrBefore(pj.times, t);
  if (i < 0) return [];
  const pts = pj.points.slice(0, (i + 1) * 2);
  const head = positionAt(pj, t);
  if (head && i < pj.times.length - 1) pts.push(head.px, head.py);
  return pts;
}

export function formatClock(seconds: number): string {
  const s = Math.max(0, Math.floor(seconds));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
}

export function shortId(id: string): string {
  return id.length > 8 ? id.slice(0, 8) : id;
}
