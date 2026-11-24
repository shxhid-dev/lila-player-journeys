import type { MapId } from "./maps";

/** Shapes of the JSON written by scripts/preprocess.py. */

export type PlayerKind = "human" | "bot";
export type EventType = "kill" | "death" | "storm" | "loot";
export const EVENT_TYPES: readonly EventType[] = ["kill", "death", "storm", "loot"];

/** Who the other party was. "unknown" = a bot's kill/death, where telemetry has no counterpart. */
export type EventDetail = "bot" | "player" | "self" | "storm" | "unknown" | null;

/** [t seconds since match start, type, world x, world z, detail] */
export type GameEvent = [number, EventType, number, number, EventDetail];

export type Outcome =
  "survived" | "killed_by_bot" | "killed_by_player" | "self_elimination" | "storm" | "died";

export interface Journey {
  id: string;
  kind: PlayerKind;
  /** ID format. A "numeric" human is one of the 17 anomalous files (see data notes). */
  idKind: "uuid" | "numeric";
  start: number;
  end: number;
  outcome: Outcome;
  stats: { kills: number; deaths: number; loot: number; survival: number };
  /** Flat [t, x, z, t, x, z, ...] in match seconds and world units. */
  path: number[];
  events: GameEvent[];
}

export interface MatchShard {
  id: string;
  map: MapId;
  date: string;
  startUtc: number;
  duration: number;
  journeys: Journey[];
}

export type MatchFlag = "numeric-id-human" | "self-elimination";

export interface MatchSummary {
  id: string;
  map: MapId;
  date: string;
  startUtc: number;
  duration: number;
  humans: number;
  bots: number;
  kills: number;
  deaths: number;
  storm: number;
  loot: number;
  survivors: number;
  flags: MatchFlag[];
}

export interface MinimapAsset {
  image: string;
  imageHi: string;
  imageSize: number;
  imageHiSize: number;
  sourceSize: [number, number];
}

export interface Manifest {
  version: number;
  dates: string[];
  maps: Record<MapId, MinimapAsset>;
  report: Record<string, number>;
  matches: MatchSummary[];
}

/** Heatmap layer codes as written by the pipeline (`e` column). */
export const HEAT_CODES = { traffic: 0, kills: 1, deaths: 2, storm: 3, loot: 4 } as const;
export type HeatLayer = keyof typeof HEAT_CODES;
export const HEAT_LAYERS = Object.keys(HEAT_CODES) as HeatLayer[];

/** Columnar heatmap points for one map. `k`: 0 human, 1 bot. `d`: index into Manifest.dates. */
export interface HeatPoints {
  map: MapId;
  count: number;
  x: number[];
  z: number[];
  t: number[];
  e: number[];
  k: number[];
  d: number[];
}
