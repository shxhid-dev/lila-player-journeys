import { describe, expect, it } from "vitest";
import { formatClock, pathUntil, positionAt, projectJourney } from "./journey";
import type { Journey } from "./types";

// GrandRift: scale 581, origin (-290, -290). World (0,0) -> px 511.1, py 512.9.
const journey: Journey = {
  id: "j",
  kind: "human",
  idKind: "uuid",
  start: 10,
  end: 30,
  outcome: "survived",
  stats: { kills: 0, deaths: 0, loot: 0, survival: 20 },
  path: [10, 0, 0, 20, 58.1, 0, 30, 58.1, 58.1],
  events: [],
};
const pj = projectJourney(journey, "GrandRift");

describe("projectJourney", () => {
  it("projects every sample through worldToMinimap", () => {
    expect(pj.times).toEqual([10, 20, 30]);
    // 58.1 world units on GrandRift = 58.1 / 581 * 1024 = 102.4 px
    expect(pj.points[2] - pj.points[0]).toBeCloseTo(102.4, 3);
    expect(pj.points[5] - pj.points[3]).toBeCloseTo(-102.4, 3); // +z is up the image
  });
});

describe("positionAt", () => {
  it("is null outside the journey's lifetime", () => {
    expect(positionAt(pj, 9)).toBeNull();
    expect(positionAt(pj, 31)).toBeNull();
  });

  it("returns exact samples and interpolates between them", () => {
    expect(positionAt(pj, 10)).toEqual({ px: pj.points[0], py: pj.points[1] });
    const mid = positionAt(pj, 15)!;
    expect(mid.px).toBeCloseTo(pj.points[0] + 51.2, 3);
    expect(mid.py).toBeCloseTo(pj.points[1], 3);
  });
});

describe("pathUntil", () => {
  it("is empty before the first sample", () => {
    expect(pathUntil(pj, 5)).toEqual([]);
  });

  it("ends at the interpolated head between samples", () => {
    const pts = pathUntil(pj, 25);
    expect(pts).toHaveLength(6);
    expect(pts[4]).toBeCloseTo(pj.points[2], 3);
    expect(pts[5]).toBeCloseTo(pj.points[3] - 51.2, 3);
  });

  it("returns the whole path at or after the end", () => {
    expect(pathUntil(pj, 999)).toEqual(pj.points);
  });
});

describe("formatClock", () => {
  it("formats match seconds as m:ss", () => {
    expect(formatClock(0)).toBe("0:00");
    expect(formatClock(382)).toBe("6:22");
    expect(formatClock(890.9)).toBe("14:50");
  });
});
