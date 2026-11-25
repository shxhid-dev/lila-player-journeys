import { describe, expect, it } from "vitest";
import { listMatches, stepMatch } from "./match-list";
import type { MatchSummary } from "./types";

const m = (id: string, over: Partial<MatchSummary> = {}): MatchSummary => ({
  id,
  map: "AmbroseValley",
  date: "2026-02-10",
  startUtc: 0,
  duration: 100,
  humans: 1,
  bots: 0,
  kills: 0,
  deaths: 0,
  storm: 0,
  loot: 0,
  survivors: 0,
  flags: [],
  ...over,
});

const rows = [
  m("aaa1", { bots: 5, startUtc: 10 }),
  m("bbb2", { kills: 9, startUtc: 30, duration: 50 }),
  m("abc3", { bots: 5, startUtc: 20, duration: 900 }),
];

describe("listMatches", () => {
  it("sorts by the chosen key and breaks ties by recency", () => {
    expect(listMatches(rows, "", "players").map((r) => r.id)).toEqual(["abc3", "aaa1", "bbb2"]);
    expect(listMatches(rows, "", "combat").map((r) => r.id)[0]).toBe("bbb2");
    expect(listMatches(rows, "", "longest").map((r) => r.id)[0]).toBe("abc3");
    expect(listMatches(rows, "", "newest").map((r) => r.id)).toEqual(["bbb2", "abc3", "aaa1"]);
  });

  it("filters by match-ID prefix, case-insensitively", () => {
    expect(listMatches(rows, " A", "newest").map((r) => r.id)).toEqual(["abc3", "aaa1"]);
    expect(listMatches(rows, "zz", "newest")).toEqual([]);
  });

  it("does not mutate its input", () => {
    const copy = [...rows];
    listMatches(rows, "", "longest");
    expect(rows).toEqual(copy);
  });
});

describe("stepMatch", () => {
  const list = listMatches(rows, "", "newest"); // bbb2, abc3, aaa1

  it("moves forward and back through the visible order", () => {
    expect(stepMatch(list, "bbb2", 1)?.id).toBe("abc3");
    expect(stepMatch(list, "abc3", -1)?.id).toBe("bbb2");
  });

  it("stops at the ends instead of wrapping", () => {
    expect(stepMatch(list, "aaa1", 1)?.id).toBe("aaa1");
    expect(stepMatch(list, "bbb2", -1)?.id).toBe("bbb2");
  });

  it("starts at the top when nothing in the list is selected", () => {
    expect(stepMatch(list, undefined, 1)?.id).toBe("bbb2");
    expect(stepMatch(list, "not-in-list", -1)?.id).toBe("bbb2");
    expect(stepMatch([], "x", 1)).toBeUndefined();
  });
});
