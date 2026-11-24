"use client";

import { MarkerIcon, PathSwatch } from "@/components/ui/marker-icon";
import { formatClock, shortId } from "@/lib/journey";
import { describeEvent, OUTCOME_LABELS, playerName } from "@/lib/labels";
import type { Scene, SceneJourney } from "@/lib/scene";
import type { Hover } from "@/store/explorer";

const CARD_W = 232;

function Stat({ label, value }: { label: string; value: string | number }) {
  return (
    <div>
      <dt className="text-[10px] tracking-wider text-muted uppercase">{label}</dt>
      <dd className="font-medium tabular-nums">{value}</dd>
    </div>
  );
}

function PlayerHeader({ sj }: { sj: SceneJourney }) {
  return (
    <div className="flex items-center gap-2">
      <PathSwatch color={sj.color} dashed={sj.dashed} />
      <span className="font-medium">{playerName(sj.journey)}</span>
      <span className="ml-auto text-[11px] text-muted">match {shortId(sj.matchId)}</span>
    </div>
  );
}

/** Floating card for whatever the pointer is over: a journey or an event marker. */
export function HoverCard({
  hover,
  scene,
  bounds,
}: {
  hover: Hover;
  scene: Scene;
  bounds: { w: number; h: number };
}) {
  const event = hover.kind === "event" ? scene.events.find((e) => e.key === hover.key) : undefined;
  const sj = scene.journeys.find((j) => j.key === (event ? event.journeyKey : hover.key));
  if (!sj) return null;
  const j = sj.journey;

  // Keep the card inside the canvas: flip to the left/top near the edges.
  const left = hover.x + 16 + CARD_W > bounds.w ? hover.x - 16 - CARD_W : hover.x + 16;
  const top = Math.min(Math.max(8, hover.y - 20), bounds.h - 170);

  return (
    <div
      role="tooltip"
      className="pointer-events-none absolute z-10 space-y-2 rounded-lg border border-border bg-panel/95 p-3 text-xs shadow-xl backdrop-blur"
      style={{ left, top, width: CARD_W }}
    >
      <PlayerHeader sj={sj} />
      {event ? (
        <div className="flex items-center gap-2">
          <MarkerIcon type={event.type} />
          <span>{describeEvent(event.type, event.detail)}</span>
          <span className="ml-auto text-muted tabular-nums">{formatClock(event.t)}</span>
        </div>
      ) : (
        <>
          <p className="text-muted">
            {OUTCOME_LABELS[j.outcome]} at {formatClock(j.end)}
            {j.kind === "human" && j.idKind === "numeric" && " · numeric account ID"}
          </p>
          <dl className="grid grid-cols-4 gap-2">
            <Stat label="Kills" value={j.stats.kills} />
            <Stat label="Deaths" value={j.stats.deaths} />
            <Stat label="Loot" value={j.stats.loot} />
            <Stat label="Alive" value={formatClock(j.stats.survival)} />
          </dl>
        </>
      )}
    </div>
  );
}
