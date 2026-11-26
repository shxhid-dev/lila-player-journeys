import { isMapId, type MapId } from "./maps";
import {
  EVENT_TYPES,
  HEAT_LAYERS,
  isHeatPhase,
  type EventType,
  type HeatLayer,
  type HeatPhase,
  type PlayerKind,
} from "./types";

/**
 * Everything a Level Designer might want to share lives in the URL, so a pasted
 * link reproduces the exact view. Transient state (hover, play/pause, pan/zoom)
 * stays out of it.
 */
export interface ViewState {
  map: MapId;
  /** Empty = all dates. */
  dates: string[];
  /**
   * Selected match ids (journeys + playback). null = not specified, which the UI
   * resolves to the map's featured match. [] = explicitly nothing selected.
   */
  matches: string[] | null;
  players: PlayerKind[];
  events: EventType[];
  heat: HeatLayer | null;
  /** Aggregate over every match in the filter, or only the selected matches. */
  heatScope: "filtered" | "selected";
  heatOpacity: number;
  /** Heatmap cell size in minimap pixels (of 1024). */
  heatBin: number;
  /** Only count heatmap points from this part of the match. */
  heatPhase: HeatPhase;
  calibration: boolean;
  /** Playback time in match seconds. null = end of match (full paths). */
  t: number | null;
}

export const HEAT_BINS = [4, 8, 16, 32] as const;
/** Compare mode cap: the journey palette validates for 3 colours on the dark map. */
export const MAX_SELECTED_MATCHES = 3;

export const DEFAULT_VIEW: ViewState = {
  map: "AmbroseValley",
  dates: [],
  matches: null,
  players: ["human", "bot"],
  events: [...EVENT_TYPES],
  heat: null,
  heatScope: "filtered",
  heatOpacity: 0.7,
  heatBin: 8,
  heatPhase: "all",
  calibration: false,
  t: null,
};

/** Comma list with empties and duplicates removed, in first-seen order. */
const list = (v: string | null) => (v ? [...new Set(v.split(",").filter(Boolean))] : []);
/** A number param; an empty or missing value counts as absent (Number("") would be 0). */
const num = (v: string | null) => (v === null || v.trim() === "" ? NaN : Number(v));
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const MATCH_RE = /^[0-9a-f-]{36}$/;
/** Below this the heatmap is effectively invisible, and the slider's minimum is 0.1. */
export const MIN_HEAT_OPACITY = 0.1;

export function parseViewState(params: URLSearchParams): ViewState {
  const map = params.get("map");
  const players = list(params.get("players")).filter(
    (p): p is PlayerKind => p === "human" || p === "bot",
  );
  const events = list(params.get("events")).filter((e): e is EventType =>
    (EVENT_TYPES as readonly string[]).includes(e),
  );
  const heat = params.get("heat");
  const opacity = num(params.get("opacity"));
  const bin = num(params.get("bin"));
  const t = num(params.get("t"));

  return {
    map: isMapId(map) ? map : DEFAULT_VIEW.map,
    dates: list(params.get("dates")).filter((d) => DATE_RE.test(d)),
    matches: params.has("match")
      ? list(params.get("match"))
          .filter((m) => MATCH_RE.test(m))
          .slice(0, MAX_SELECTED_MATCHES)
      : null,
    players: params.has("players") ? players : DEFAULT_VIEW.players,
    events: params.has("events") ? events : DEFAULT_VIEW.events,
    heat: (HEAT_LAYERS as readonly string[]).includes(heat ?? "") ? (heat as HeatLayer) : null,
    heatScope: params.get("scope") === "selected" ? "selected" : "filtered",
    heatOpacity:
      Number.isFinite(opacity) && opacity >= MIN_HEAT_OPACITY && opacity <= 1
        ? opacity
        : DEFAULT_VIEW.heatOpacity,
    heatBin: (HEAT_BINS as readonly number[]).includes(bin) ? bin : DEFAULT_VIEW.heatBin,
    heatPhase: isHeatPhase(params.get("phase")) ? (params.get("phase") as HeatPhase) : "all",
    calibration: params.get("grid") === "1",
    t: Number.isFinite(t) && t >= 0 ? Math.floor(t) : null,
  };
}

/**
 * Reuse the previous state's arrays when their contents are unchanged. Every URL write
 * produces a fresh parse, and without this, unrelated changes (an opacity tick, the
 * mirrored playback time) would give `dates` and friends new identities. That would
 * re-bin heatmaps, rebuild the scene and reset the match list.
 */
export function shareViewState(prev: ViewState | null, next: ViewState): ViewState {
  if (!prev) return next;
  const keep = <T>(a: readonly T[] | null, b: readonly T[] | null) =>
    a && b && a.length === b.length && a.every((x, i) => x === b[i]) ? a : b;
  const shared = {
    ...next,
    dates: keep(prev.dates, next.dates) as string[],
    matches: keep(prev.matches, next.matches) as string[] | null,
    players: keep(prev.players, next.players) as PlayerKind[],
    events: keep(prev.events, next.events) as EventType[],
  };
  const changed = (Object.keys(shared) as (keyof ViewState)[]).some((k) => shared[k] !== prev[k]);
  return changed ? shared : prev;
}

const sameSet = <T>(a: readonly T[], b: readonly T[]) =>
  a.length === b.length && a.every((x) => b.includes(x));

/** Inverse of parseViewState. Defaults are omitted to keep links short. */
export function serializeViewState(s: ViewState): string {
  const p = new URLSearchParams();
  if (s.map !== DEFAULT_VIEW.map) p.set("map", s.map);
  if (s.dates.length) p.set("dates", [...s.dates].sort().join(","));
  if (s.matches) p.set("match", s.matches.length ? s.matches.join(",") : "none");
  if (!sameSet(s.players, DEFAULT_VIEW.players)) p.set("players", s.players.join(","));
  if (!sameSet(s.events, DEFAULT_VIEW.events)) p.set("events", s.events.join(","));
  if (s.heat) p.set("heat", s.heat);
  if (s.heatScope !== DEFAULT_VIEW.heatScope) p.set("scope", s.heatScope);
  if (s.heatOpacity !== DEFAULT_VIEW.heatOpacity) p.set("opacity", s.heatOpacity.toFixed(2));
  if (s.heatBin !== DEFAULT_VIEW.heatBin) p.set("bin", String(s.heatBin));
  if (s.heatPhase !== DEFAULT_VIEW.heatPhase) p.set("phase", s.heatPhase);
  if (s.calibration) p.set("grid", "1");
  if (s.t !== null) p.set("t", String(Math.floor(s.t)));
  // URLSearchParams encodes commas; they are safe in a query string and read better unescaped.
  return p.toString().replaceAll("%2C", ",");
}
