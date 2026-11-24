import { describe, expect, it } from "vitest";
import { MINIMAP_SIZE, minimapToWorld, worldBounds, worldToMinimap, worldToUV } from "./coords";
import { MAP_IDS, MAPS } from "./maps";

describe("worldToMinimap", () => {
  it("reproduces the README worked example (AmbroseValley)", () => {
    const { px, py } = worldToMinimap(-301.45, -355.55, "AmbroseValley");
    expect(px).toBeCloseTo(78.0, 0);
    expect(py).toBeCloseTo(890.4, 0);
  });

  describe.each(MAP_IDS)("%s", (mapId) => {
    const b = worldBounds(mapId);

    it("maps the world origin (min x, min z) to the bottom-left corner", () => {
      const p = worldToMinimap(b.minX, b.minZ, mapId);
      expect(p.px).toBeCloseTo(0, 6);
      expect(p.py).toBeCloseTo(MINIMAP_SIZE, 6);
    });

    it("maps (max x, max z) to the top-right corner", () => {
      const p = worldToMinimap(b.maxX, b.maxZ, mapId);
      expect(p.px).toBeCloseTo(MINIMAP_SIZE, 6);
      expect(p.py).toBeCloseTo(0, 6);
    });

    it("maps the world-box centre to the image centre", () => {
      const p = worldToMinimap((b.minX + b.maxX) / 2, (b.minZ + b.maxZ) / 2, mapId);
      expect(p.px).toBeCloseTo(MINIMAP_SIZE / 2, 6);
      expect(p.py).toBeCloseTo(MINIMAP_SIZE / 2, 6);
    });

    it("moves right for +x and up (smaller py) for +z", () => {
      const a = worldToMinimap(0, 0, mapId);
      expect(worldToMinimap(10, 0, mapId).px).toBeGreaterThan(a.px);
      expect(worldToMinimap(0, 10, mapId).py).toBeLessThan(a.py);
    });

    it("round-trips through minimapToWorld within 1px", () => {
      for (const [x, z] of [
        [b.minX + 13.7, b.minZ + 291.2],
        [0, 0],
        [b.maxX - 1, b.maxZ - 1],
      ]) {
        const p = worldToMinimap(x, z, mapId);
        const w = minimapToWorld(p.px, p.py, mapId);
        const back = worldToMinimap(w.x, w.z, mapId);
        expect(Math.abs(back.px - p.px)).toBeLessThan(1);
        expect(Math.abs(back.py - p.py)).toBeLessThan(1);
        expect(w.x).toBeCloseTo(x, 6);
        expect(w.z).toBeCloseTo(z, 6);
      }
    });

    it("scales linearly with the target image size", () => {
      const small = worldToMinimap(12.5, -40, mapId, 1024);
      const big = worldToMinimap(12.5, -40, mapId, 4096);
      expect(big.px).toBeCloseTo(small.px * 4, 6);
      expect(big.py).toBeCloseTo(small.py * 4, 6);
    });
  });
});

describe("worldToUV", () => {
  it("keeps every observed data extent inside 0..1 (from docs/data-notes.md)", () => {
    const extents = {
      AmbroseValley: { x: [-325.0, 301.8], z: [-380.0, 360.8] },
      GrandRift: { x: [-225.9, 256.6], z: [-194.0, 170.1] },
      Lockdown: { x: [-406.6, 348.4], z: [-285.1, 329.2] },
    } as const;
    for (const mapId of MAP_IDS) {
      const e = extents[mapId];
      for (const x of e.x) {
        for (const z of e.z) {
          const { u, v } = worldToUV(x, z, mapId);
          expect(u).toBeGreaterThan(0);
          expect(u).toBeLessThan(1);
          expect(v).toBeGreaterThan(0);
          expect(v).toBeLessThan(1);
        }
      }
    }
  });

  it("uses the README configuration", () => {
    expect(MAPS.AmbroseValley).toMatchObject({ scale: 900, originX: -370, originZ: -473 });
    expect(MAPS.GrandRift).toMatchObject({ scale: 581, originX: -290, originZ: -290 });
    expect(MAPS.Lockdown).toMatchObject({ scale: 1000, originX: -500, originZ: -500 });
  });
});
