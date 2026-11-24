import type { EventType } from "./types";

/**
 * Human journeys: categorical slots 1-3 of the reference data-viz palette (dark
 * steps). These three pass every all-pairs colour-blind and normal-vision check
 * against the dark minimap surface, which is why compare mode caps at 3 matches.
 * Assigned in fixed order, never cycled.
 */
export const HUMAN_COLORS = ["#3987e5", "#d95926", "#199e70"] as const;
/** A 4th+ human (only possible when the 2-human match is compared): primary ink, still solid. */
export const HUMAN_OVERFLOW_COLOR = "#f0efec";
/** Bots: one desaturated neutral, dashed. Identity comes from hover, not hue. */
export const BOT_COLOR = "#a9a8a0";
/** Dark casing drawn under every mark so it reads on any minimap. */
export const CASING = "#0b0d10";

export interface EventStyle {
  label: string;
  color: string;
  shape: "triangle" | "cross" | "diamond" | "circle";
}

/** Shape and colour both carry the type, so it never relies on colour alone. */
export const EVENT_STYLES: Record<EventType, EventStyle> = {
  kill: { label: "Kill", color: "#e66767", shape: "triangle" },
  death: { label: "Death", color: "#f0efec", shape: "cross" },
  storm: { label: "Storm death", color: "#9085e9", shape: "diamond" },
  loot: { label: "Loot pickup", color: "#eda100", shape: "circle" },
};

/** Sequential heatmap ramp: one hue (blue), dark/transparent = low, light = high. */
export const HEAT_RAMP = [
  "#1c5cab",
  "#2a78d6",
  "#3987e5",
  "#5598e7",
  "#86b6ef",
  "#b7d3f6",
  "#cde2fb",
] as const;
