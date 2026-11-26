export const MAP_IDS = ["AmbroseValley", "GrandRift", "Lockdown"] as const;
export type MapId = (typeof MAP_IDS)[number];

export interface MapConfig {
  id: MapId;
  label: string;
  /** Compact label for narrow screens. */
  short: string;
  /** World units covered by the minimap along each axis. */
  scale: number;
  /** World X at the minimap's left edge. */
  originX: number;
  /** World Z at the minimap's bottom edge. */
  originZ: number;
}

/** From the data README ("Map Configuration"). Verified against the data in docs/data-notes.md. */
export const MAPS: Record<MapId, MapConfig> = {
  AmbroseValley: {
    id: "AmbroseValley",
    label: "Ambrose Valley",
    short: "Ambrose",
    scale: 900,
    originX: -370,
    originZ: -473,
  },
  GrandRift: {
    id: "GrandRift",
    label: "Grand Rift",
    short: "Grand Rift",
    scale: 581,
    originX: -290,
    originZ: -290,
  },
  Lockdown: {
    id: "Lockdown",
    label: "Lockdown",
    short: "Lockdown",
    scale: 1000,
    originX: -500,
    originZ: -500,
  },
};

/** Minimap image URL. Follows the pipeline's naming, so it can be requested before the manifest arrives. */
export function minimapUrl(mapId: MapId): string {
  return `/data/minimaps/${mapId}.webp`;
}

export function isMapId(value: unknown): value is MapId {
  return typeof value === "string" && (MAP_IDS as readonly string[]).includes(value);
}
