import { describe, expect, it } from "vitest";
import { BOT_COLOR, HUMAN_COLORS, HUMAN_OVERFLOW_COLOR } from "./colors";
import { buildScene, journeyKey, pickFeaturedMatch } from "./scene";
import type { Journey, MatchShard, MatchSummary } from "./types";

const journey = (id: string, kind: Journey["kind"], events: Journey["events"] = []): Journey => ({
  id,
  kind,
  idKind: kind === "human" ? "uuid" : "numeric",
  start: 0,
  end: 10,
  outcome: "survived",
  stats: { kills: 0, deaths: 0, loot: 0, survival: 10 },
  path: [0, 0, 0, 10, 5, 5],
  events,
});

const shard = (id: string, journeys: Journey[], duration = 100): MatchShard => ({
  id,
  map: "Lockdown",
  date: "2026-02-10",
  startUtc: 0,
  duration,
  journeys,
});

const all = {
  players: ["human", "bot"] as const,
  events: ["kill", "death", "storm", "loot"] as const,
};
const filters = (over: Partial<Parameters<typeof buildScene>[2]> = {}) => ({
  players: [...all.players],
  events: [...all.events],
  hidden: new Set<string>(),
  ...over,
});

describe("buildScene", () => {
  const shards = [
    shard(
      "m1",
      [journey("h1", "human"), journey("b1", "bot", [[5, "kill", 1, 1, "unknown"]])],
      300,
    ),
    shard(
      "m2",
      [
        journey("h2", "human", [
          [2, "loot", 0, 0, null],
          [8, "death", 3, 3, "bot"],
        ]),
      ],
      500,
    ),
  ];

  it("colours humans in fixed order across matches and bots neutral + dashed", () => {
    const s = buildScene(shards, "Lockdown", filters());
    const byId = Object.fromEntries(s.journeys.map((j) => [j.journey.id, j]));
    expect(byId.h1.color).toBe(HUMAN_COLORS[0]);
    expect(byId.h2.color).toBe(HUMAN_COLORS[1]);
    expect(byId.b1.color).toBe(BOT_COLOR);
    expect(byId.b1.dashed).toBe(true);
    expect(s.duration).toBe(500);
  });

  it("keeps colours stable when filters remove players", () => {
    const s = buildScene(
      shards,
      "Lockdown",
      filters({ hidden: new Set([journeyKey("m1", "h1")]) }),
    );
    expect(s.journeys.find((j) => j.journey.id === "h2")?.color).toBe(HUMAN_COLORS[1]);
  });

  it("filters by player kind and event type", () => {
    const s = buildScene(shards, "Lockdown", filters({ players: ["human"], events: ["death"] }));
    expect(s.journeys.map((j) => j.journey.id)).toEqual(["h1", "h2"]);
    expect(s.events.map((e) => e.type)).toEqual(["death"]);
  });

  it("draws loot underneath combat", () => {
    const s = buildScene(shards, "Lockdown", filters());
    expect(s.events.map((e) => e.type)).toEqual(["loot", "kill", "death"]);
  });

  it("ignores shards from another map", () => {
    expect(buildScene(shards, "GrandRift", filters()).journeys).toHaveLength(0);
  });

  it("falls back to the overflow colour past three humans", () => {
    const many = [1, 2, 3, 4].map((i) => shard(`m${i}`, [journey(`h${i}`, "human")]));
    const s = buildScene(many, "Lockdown", filters());
    expect(s.journeys.map((j) => j.color)).toEqual([...HUMAN_COLORS, HUMAN_OVERFLOW_COLOR]);
  });
});

describe("pickFeaturedMatch", () => {
  const m = (
    id: string,
    humans: number,
    bots: number,
    kills = 0,
    duration = 100,
  ): MatchSummary => ({
    id,
    map: "AmbroseValley",
    date: "2026-02-10",
    startUtc: 0,
    duration,
    humans,
    bots,
    kills,
    deaths: 0,
    storm: 0,
    loot: 0,
    survivors: 0,
    flags: [],
  });

  it("prefers the most journeys, then combat, then duration", () => {
    expect(pickFeaturedMatch([m("a", 1, 0, 9), m("b", 1, 6), m("c", 1, 6, 2)])?.id).toBe("c");
    expect(pickFeaturedMatch([m("a", 1, 0, 0, 900), m("b", 1, 0, 0, 100)])?.id).toBe("a");
  });

  it("is order-independent", () => {
    const list = [m("x", 1, 2), m("y", 1, 2), m("z", 1, 1)];
    expect(pickFeaturedMatch(list)?.id).toBe(pickFeaturedMatch([...list].reverse())?.id);
  });

  it("handles an empty list", () => {
    expect(pickFeaturedMatch([])).toBeUndefined();
  });
});
