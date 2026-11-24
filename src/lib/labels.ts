import { shortId } from "./journey";
import type { EventDetail, EventType, Journey, MatchFlag, Outcome } from "./types";

export const OUTCOME_LABELS: Record<Outcome, string> = {
  survived: "Survived",
  killed_by_bot: "Killed by bot",
  killed_by_player: "Killed by player",
  self_elimination: "Self-elimination",
  storm: "Killed by storm",
  died: "Died",
};

export function playerName(j: Pick<Journey, "id" | "kind">): string {
  return j.kind === "human" ? `Player ${shortId(j.id)}` : `Bot #${j.id}`;
}

/** Plain-language event description from the owner's point of view. */
export function describeEvent(type: EventType, detail: EventDetail): string {
  switch (type) {
    case "loot":
      return "Picked up an item";
    case "storm":
      return "Killed by the storm";
    case "kill":
      if (detail === "bot") return "Killed a bot";
      if (detail === "player") return "Killed a player";
      return "Got a kill (victim not recorded)";
    case "death":
      if (detail === "bot") return "Killed by a bot";
      if (detail === "player") return "Killed by a player";
      if (detail === "self") return "Self-elimination";
      return "Died (killer not recorded)";
  }
}

export const FLAG_NOTES: Record<MatchFlag, string> = {
  "numeric-id-human":
    "A player here has a numeric (bot-style) ID but emits human-only telemetry, so they're treated as human.",
  "self-elimination":
    "Includes a self-elimination: the game logged Kill and Killed for the same player in the same second.",
};

export function formatUtc(unixSeconds: number): string {
  return new Date(unixSeconds * 1000).toLocaleString("en-GB", {
    timeZone: "UTC",
    day: "numeric",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  });
}
