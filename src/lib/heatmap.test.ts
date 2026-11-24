import { describe, expect, it } from "vitest";
import { worldToMinimap } from "./coords";
import { binPoints, intensity, selectHeatPoints, shardHeatPoints } from "./heatmap";
import type { HeatPoints, MatchShard } from "./types";

describe("binPoints", () => {
  it("counts points into the cell their minimap position falls in", () => {
    // Lockdown: world (0,0) -> minimap (512, 512) -> cell (64, 64) at 8px.
    // (2, -2) is ~2px right and down of the origin, so it shares the cell.
    const g = binPoints({ x: [0, 0, 2], z: [0, 0, -2], length: 3 }, "Lockdown", 8);
    expect(g.n).toBe(128);
    expect(g.total).toBe(3);
    const { px, py } = worldToMinimap(0, 0, "Lockdown");
    expect(g.cells[Math.floor(py / 8) * 128 + Math.floor(px / 8)]).toBe(3);
  });

  it("drops points outside the world box instead of wrapping them", () => {
    const g = binPoints({ x: [-9999, 9999], z: [0, 0], length: 2 }, "Lockdown", 8);
    expect(g.total).toBe(0);
  });

  it("supports every exposed bin size", () => {
    for (const cell of [4, 8, 16, 32]) {
      expect(binPoints({ x: [], z: [], length: 0 }, "GrandRift", cell).n).toBe(1024 / cell);
    }
  });
});

describe("intensity", () => {
  it("is 0 for empty cells and saturates at the p99 count", () => {
    expect(intensity(0, 10)).toBe(0);
    expect(intensity(10, 10)).toBe(1);
    expect(intensity(500, 10)).toBe(1);
  });

  it("is log-scaled so sparse cells stay visible", () => {
    expect(intensity(1, 100)).toBeGreaterThan(0.1);
    expect(intensity(10, 100)).toBeGreaterThan(intensity(1, 100));
  });
});

describe("selectHeatPoints", () => {
  const pts: HeatPoints = {
    map: "Lockdown",
    count: 5,
    x: [1, 2, 3, 4, 5],
    z: [0, 0, 0, 0, 0],
    t: [0, 0, 0, 0, 0],
    e: [0, 0, 1, 2, 0],
    k: [0, 1, 0, 0, 0],
    d: [0, 0, 0, 1, 2],
  };

  it("filters by layer, player kind and date", () => {
    expect(
      selectHeatPoints(pts, { layer: "traffic", players: ["human", "bot"], dateIdx: [] }).x,
    ).toEqual([1, 2, 5]);
    expect(selectHeatPoints(pts, { layer: "traffic", players: ["human"], dateIdx: [] }).x).toEqual([
      1, 5,
    ]);
    expect(selectHeatPoints(pts, { layer: "traffic", players: ["human"], dateIdx: [2] }).x).toEqual(
      [5],
    );
    expect(selectHeatPoints(pts, { layer: "deaths", players: ["human"], dateIdx: [] }).x).toEqual([
      4,
    ]);
  });
});

describe("match phase filter", () => {
  const pts: HeatPoints = {
    map: "Lockdown",
    count: 4,
    x: [1, 2, 3, 4],
    z: [0, 0, 0, 0],
    t: [0, 179, 180, 700],
    e: [0, 0, 0, 0],
    k: [0, 0, 0, 0],
    d: [0, 0, 0, 0],
  };
  const pick = (phase: "all" | "early" | "mid" | "late") =>
    selectHeatPoints(pts, { layer: "traffic", players: ["human"], dateIdx: [], phase }).x;

  it("splits points into half-open [from, to) phases with no gaps or overlaps", () => {
    expect(pick("early")).toEqual([1, 2]);
    expect(pick("mid")).toEqual([3]);
    expect(pick("late")).toEqual([4]);
    expect(pick("all")).toEqual([1, 2, 3, 4]);
  });
});

describe("shardHeatPoints", () => {
  const shard: MatchShard = {
    id: "m",
    map: "Lockdown",
    date: "2026-02-10",
    startUtc: 0,
    duration: 10,
    journeys: [
      {
        id: "h",
        kind: "human",
        idKind: "uuid",
        start: 0,
        end: 10,
        outcome: "storm",
        stats: { kills: 0, deaths: 1, loot: 0, survival: 10 },
        path: [0, 1, 1, 5, 2, 2],
        events: [[10, "storm", 2, 2, "storm"]],
      },
    ],
  };

  it("uses path samples for traffic and matching events for event layers", () => {
    expect(shardHeatPoints([shard], "traffic", ["human"]).length).toBe(2);
    expect(shardHeatPoints([shard], "storm", ["human"]).length).toBe(1);
    expect(shardHeatPoints([shard], "kills", ["human"]).length).toBe(0);
    expect(shardHeatPoints([shard], "traffic", ["bot"]).length).toBe(0);
  });

  it("applies the match phase to path samples and events", () => {
    // Path samples at t=0 and t=5; the storm death is at t=10.
    expect(shardHeatPoints([shard], "traffic", ["human"], "early").length).toBe(2);
    expect(shardHeatPoints([shard], "traffic", ["human"], "late").length).toBe(0);
    expect(shardHeatPoints([shard], "storm", ["human"], "mid").length).toBe(0);
  });
});
