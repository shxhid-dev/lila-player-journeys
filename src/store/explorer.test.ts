import { describe, expect, it } from "vitest";
import { fitViewport, MAX_ZOOM, viewportForBounds } from "./explorer";

describe("viewportForBounds", () => {
  const W = 800;
  const H = 600;

  it("centres the box in the viewport", () => {
    const v = viewportForBounds({ minX: 100, minY: 200, maxX: 300, maxY: 400 }, W, H);
    // Screen position of the box centre (200, 300) must be the viewport centre.
    expect(200 * v.scale + v.x).toBeCloseTo(W / 2, 6);
    expect(300 * v.scale + v.y).toBeCloseTo(H / 2, 6);
  });

  it("fits the box inside the padded viewport", () => {
    const v = viewportForBounds({ minX: 0, minY: 0, maxX: 400, maxY: 100 }, W, H, 48);
    expect(400 * v.scale).toBeLessThanOrEqual(W - 96 + 1e-6);
    expect(100 * v.scale).toBeLessThanOrEqual(H - 96 + 1e-6);
  });

  it("does not zoom past the maximum for a player who barely moved", () => {
    const v = viewportForBounds({ minX: 500, minY: 500, maxX: 501, maxY: 501 }, W, H);
    expect(v.scale).toBeLessThanOrEqual(fitViewport(W, H).scale * MAX_ZOOM);
  });
});
