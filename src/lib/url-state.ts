import { isMapId, type MapId } from "./maps";
import { EVENT_TYPES, HEAT_LAYERS, type EventType, type HeatLayer, type PlayerKind } from "./types";

/**
 * Everything a Level Designer might want to share lives in the URL, so a pasted
 * link reproduces the exact view. Transient state (hover, play/pause, pan/zoom)
 * stays out of it.
 */
export interface ViewState {
  map: MapId;
  /** Empty = all dates. */
  dates: string[];
  /** Selected match ids (journeys + playback). */
  matches: string[];
  players: PlayerKind[];
  events: EventType[];
  heat: HeatLayer | null;
  /** Aggregate over every match in the filter, or only the selected matches. */
  heatScope: "filtered" | "selected";
  heatOpacity: number;
  /** Heatmap cell size in minimap pixels (of 1024). */
  heatBin: number;
  calibration: boolean;
  /** Playback time in match seconds. null = end of match (full paths). */
  t: number | null;
}

export const HEAT_BINS = [4, 8, 16, 32] as const;

export const DEFAULT_VIEW: ViewState = {
  map: "AmbroseValley",
  dates: [],
  matches: [],
  players: ["human", "bot"],
  events: [...EVENT_TYPES],
  heat: null,
  heatScope: "filtered",
  heatOpacity: 0.7,
  heatBin: 8,
  calibration: false,
  t: null,
};

const list = (v: string | null) => (v ? v.split(",").filter(Boolean) : []);
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const MATCH_RE = /^[0-9a-f-]{36}$/;

export function parseViewState(params: URLSearchParams): ViewState {
  const map = params.get("map");
  const players = list(params.get("players")).filter(
    (p): p is PlayerKind => p === "human" || p === "bot",
  );
  const events = list(params.get("events")).filter((e): e is EventType =>
    (EVENT_TYPES as readonly string[]).includes(e),
  );
  const heat = params.get("heat");
  const opacity = Number(params.get("opacity"));
  const bin = Number(params.get("bin"));
  const t = params.get("t");
  const tNum = t === null ? NaN : Number(t);

  return {
    map: isMapId(map) ? map : DEFAULT_VIEW.map,
    dates: list(params.get("dates")).filter((d) => DATE_RE.test(d)),
    matches: list(params.get("match")).filter((m) => MATCH_RE.test(m)),
    players: params.has("players") ? players : DEFAULT_VIEW.players,
    events: params.has("events") ? events : DEFAULT_VIEW.events,
    heat: (HEAT_LAYERS as readonly string[]).includes(heat ?? "") ? (heat as HeatLayer) : null,
    heatScope: params.get("scope") === "selected" ? "selected" : "filtered",
    heatOpacity:
      params.has("opacity") && opacity >= 0 && opacity <= 1 ? opacity : DEFAULT_VIEW.heatOpacity,
    heatBin: (HEAT_BINS as readonly number[]).includes(bin) ? bin : DEFAULT_VIEW.heatBin,
    calibration: params.get("grid") === "1",
    t: Number.isFinite(tNum) && tNum >= 0 ? Math.floor(tNum) : null,
  };
}

const sameSet = <T>(a: readonly T[], b: readonly T[]) =>
  a.length === b.length && a.every((x) => b.includes(x));

/** Inverse of parseViewState. Defaults are omitted to keep links short. */
export function serializeViewState(s: ViewState): string {
  const p = new URLSearchParams();
  if (s.map !== DEFAULT_VIEW.map) p.set("map", s.map);
  if (s.dates.length) p.set("dates", [...s.dates].sort().join(","));
  if (s.matches.length) p.set("match", s.matches.join(","));
  if (!sameSet(s.players, DEFAULT_VIEW.players)) p.set("players", s.players.join(","));
  if (!sameSet(s.events, DEFAULT_VIEW.events)) p.set("events", s.events.join(","));
  if (s.heat) p.set("heat", s.heat);
  if (s.heatScope !== DEFAULT_VIEW.heatScope) p.set("scope", s.heatScope);
  if (s.heatOpacity !== DEFAULT_VIEW.heatOpacity) p.set("opacity", s.heatOpacity.toFixed(2));
  if (s.heatBin !== DEFAULT_VIEW.heatBin) p.set("bin", String(s.heatBin));
  if (s.calibration) p.set("grid", "1");
  if (s.t !== null) p.set("t", String(Math.floor(s.t)));
  // URLSearchParams encodes commas; they are safe in a query string and read better unescaped.
  return p.toString().replaceAll("%2C", ",");
}
