import { BOT_COLOR, HUMAN_COLORS, HUMAN_OVERFLOW_COLOR } from "./colors";
import { worldToMinimap } from "./coords";
import { projectJourney, type ProjectedJourney } from "./journey";
import type { MapId } from "./maps";
import type {
  EventDetail,
  EventType,
  Journey,
  MatchShard,
  MatchSummary,
  PlayerKind,
} from "./types";

/** Everything the canvas draws for the current selection, already in minimap space. */

export interface SceneJourney {
  key: string;
  matchId: string;
  journey: Journey;
  projected: ProjectedJourney;
  color: string;
  dashed: boolean;
}

export interface SceneEvent {
  key: string;
  journeyKey: string;
  matchId: string;
  t: number;
  type: EventType;
  detail: EventDetail;
  px: number;
  py: number;
  ownerKind: PlayerKind;
}

export interface Scene {
  journeys: SceneJourney[];
  events: SceneEvent[];
  /** Longest selected match, in seconds. */
  duration: number;
}

export const journeyKey = (matchId: string, userId: string) => `${matchId}:${userId}`;

export interface SceneFilters {
  players: PlayerKind[];
  events: EventType[];
  hidden: ReadonlySet<string>;
}

/**
 * Colour per journey across the whole selection. Colour follows the entity: it is
 * assigned before any filtering, so toggling filters never repaints anyone.
 */
export function journeyColors(shards: MatchShard[], mapId: MapId): Map<string, string> {
  const colors = new Map<string, string>();
  let humanIndex = 0;
  for (const shard of shards) {
    if (shard.map !== mapId) continue;
    for (const j of shard.journeys) {
      colors.set(
        journeyKey(shard.id, j.id),
        j.kind === "human" ? (HUMAN_COLORS[humanIndex++] ?? HUMAN_OVERFLOW_COLOR) : BOT_COLOR,
      );
    }
  }
  return colors;
}

export function buildScene(shards: MatchShard[], mapId: MapId, filters: SceneFilters): Scene {
  const journeys: SceneJourney[] = [];
  const events: SceneEvent[] = [];
  const colors = journeyColors(shards, mapId);
  let duration = 0;

  for (const shard of shards) {
    if (shard.map !== mapId) continue;
    duration = Math.max(duration, shard.duration);
    for (const journey of shard.journeys) {
      const key = journeyKey(shard.id, journey.id);
      const color = colors.get(key) ?? BOT_COLOR;
      if (!filters.players.includes(journey.kind) || filters.hidden.has(key)) continue;

      journeys.push({
        key,
        matchId: shard.id,
        journey,
        projected: projectJourney(journey, mapId),
        color,
        dashed: journey.kind === "bot",
      });
      journey.events.forEach(([t, type, x, z, detail], i) => {
        if (!filters.events.includes(type)) return;
        const { px, py } = worldToMinimap(x, z, mapId);
        events.push({
          key: `${key}:${i}`,
          journeyKey: key,
          matchId: shard.id,
          t,
          type,
          detail,
          px,
          py,
          ownerKind: journey.kind,
        });
      });
    }
  }
  // Loot under combat under deaths, so the rare events are never buried.
  const order: Record<EventType, number> = { loot: 0, kill: 1, death: 2, storm: 3 };
  events.sort((a, b) => order[a.type] - order[b.type] || a.t - b.t);
  return { journeys, events, duration };
}

/**
 * The match shown when a link names none: the busiest one (most journeys with
 * telemetry, then most combat, then longest). Deterministic, so a bare link always
 * opens on the same match.
 */
export function pickFeaturedMatch(matches: MatchSummary[]): MatchSummary | undefined {
  let best: MatchSummary | undefined;
  const score = (m: MatchSummary) => [m.humans + m.bots, m.kills + m.deaths + m.storm, m.duration];
  for (const m of matches) {
    if (!best) {
      best = m;
      continue;
    }
    const a = score(m);
    const b = score(best);
    const cmp = a[0] - b[0] || a[1] - b[1] || a[2] - b[2] || (m.id < best.id ? 1 : -1);
    if (cmp > 0) best = m;
  }
  return best;
}
