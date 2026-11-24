import { MAPS, type MapId } from "./maps";

/**
 * Side length of the canonical minimap space, in "map pixels". Everything on the
 * canvas is laid out in this space: the minimap image is drawn at 1024x1024 no
 * matter its real resolution, and pan/zoom is a transform on top of it. 1024 is
 * the size the data README's formula uses, so its worked example applies as-is.
 */
export const MINIMAP_SIZE = 1024;

export interface UV {
  u: number;
  v: number;
}

export interface MinimapPoint {
  px: number;
  py: number;
}

export interface WorldPoint {
  x: number;
  z: number;
}

/**
 * World (x, z) to normalized UV. u grows east (+x), v grows north (+z), and both
 * are 0..1 inside the map's world box. The `y` column is elevation and is not used.
 */
export function worldToUV(x: number, z: number, mapId: MapId): UV {
  const { scale, originX, originZ } = MAPS[mapId];
  return { u: (x - originX) / scale, v: (z - originZ) / scale };
}

/**
 * World (x, z) to minimap pixels. Image space is Y-down with its origin at the
 * top-left, while world +z points up the map, so v is flipped.
 */
export function worldToMinimap(
  x: number,
  z: number,
  mapId: MapId,
  size: number = MINIMAP_SIZE,
): MinimapPoint {
  const { u, v } = worldToUV(x, z, mapId);
  return { px: u * size, py: (1 - v) * size };
}

/** Inverse of {@link worldToMinimap}. Used by the calibration overlay and cursor readout. */
export function minimapToWorld(
  px: number,
  py: number,
  mapId: MapId,
  size: number = MINIMAP_SIZE,
): WorldPoint {
  const { scale, originX, originZ } = MAPS[mapId];
  return { x: (px / size) * scale + originX, z: (1 - py / size) * scale + originZ };
}

/** World-space bounds of a map: what the minimap covers. */
export function worldBounds(mapId: MapId) {
  const { scale, originX, originZ } = MAPS[mapId];
  return { minX: originX, maxX: originX + scale, minZ: originZ, maxZ: originZ + scale };
}
