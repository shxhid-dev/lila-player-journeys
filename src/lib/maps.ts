export const MAP_IDS = ["AmbroseValley", "GrandRift", "Lockdown"] as const;
export type MapId = (typeof MAP_IDS)[number];

export interface MapConfig {
  id: MapId;
  label: string;
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
    scale: 900,
    originX: -370,
    originZ: -473,
  },
  GrandRift: { id: "GrandRift", label: "Grand Rift", scale: 581, originX: -290, originZ: -290 },
  Lockdown: { id: "Lockdown", label: "Lockdown", scale: 1000, originX: -500, originZ: -500 },
};

export function isMapId(value: unknown): value is MapId {
  return typeof value === "string" && (MAP_IDS as readonly string[]).includes(value);
}
