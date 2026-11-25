import type { MatchSummary } from "./types";

export type SortKey = "players" | "combat" | "longest" | "newest";

export const SORTS: Record<
  SortKey,
  { label: string; fn: (a: MatchSummary, b: MatchSummary) => number }
> = {
  players: { label: "Most players", fn: (a, b) => b.humans + b.bots - (a.humans + a.bots) },
  combat: {
    label: "Most combat",
    fn: (a, b) => b.kills + b.deaths + b.storm - (a.kills + a.deaths + a.storm),
  },
  longest: { label: "Longest", fn: (a, b) => b.duration - a.duration },
  newest: { label: "Newest", fn: (a, b) => b.startUtc - a.startUtc },
};

/** The match list as shown: ID-prefix search, then the chosen sort (newest breaks ties). */
export function listMatches(matches: MatchSummary[], query: string, sort: SortKey): MatchSummary[] {
  const q = query.trim().toLowerCase();
  return matches
    .filter((m) => !q || m.id.startsWith(q))
    .sort((a, b) => SORTS[sort].fn(a, b) || b.startUtc - a.startUtc || (a.id < b.id ? -1 : 1));
}

/**
 * The match `step` rows away from the current one, for N / P keyboard navigation.
 * From no selection (or one not in the list) it starts at the top. It stops at the
 * ends instead of wrapping.
 */
export function stepMatch(
  rows: MatchSummary[],
  currentId: string | undefined,
  step: 1 | -1,
): MatchSummary | undefined {
  if (!rows.length) return undefined;
  const i = currentId ? rows.findIndex((m) => m.id === currentId) : -1;
  if (i < 0) return rows[0];
  return rows[Math.min(rows.length - 1, Math.max(0, i + step))];
}
