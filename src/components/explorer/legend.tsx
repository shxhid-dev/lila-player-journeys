"use client";

import { ChevronDown, ListTree } from "lucide-react";
import { useEffect, useState } from "react";
import { MarkerIcon, PathSwatch } from "@/components/ui/marker-icon";
import { BOT_COLOR, HUMAN_COLORS } from "@/lib/colors";
import { EVENT_TYPES } from "@/lib/types";

const STORAGE_KEY = "lila.legend-open";

const EVENT_LABELS = {
  kill: "Kill (got a kill)",
  death: "Death (by bot or player)",
  storm: "Killed by storm",
  loot: "Loot pickup",
} as const;

/**
 * Floating, collapsible legend in the map's corner, so it stays in view whatever the
 * side panels hold. It starts open on desktop and closed on phones, and remembers
 * the user's choice.
 */
export function MapLegend() {
  const [open, setOpen] = useState(false);

  useEffect(() => {
    const saved = window.localStorage.getItem(STORAGE_KEY);
    setOpen(saved === null ? window.innerWidth >= 768 : saved === "1");
  }, []);

  const toggle = () => {
    setOpen((o) => {
      window.localStorage.setItem(STORAGE_KEY, o ? "0" : "1");
      return !o;
    });
  };

  if (!open) {
    return (
      <button
        type="button"
        onClick={toggle}
        aria-expanded={false}
        aria-controls="map-legend"
        className="absolute right-3 bottom-3 flex items-center gap-1.5 rounded-md border border-border bg-panel/90 px-2.5 py-1.5 text-xs text-muted shadow-lg backdrop-blur hover:text-foreground"
      >
        <ListTree className="h-3.5 w-3.5" />
        Legend
      </button>
    );
  }

  return (
    <section
      id="map-legend"
      aria-label="Legend"
      className="absolute right-3 bottom-3 w-60 rounded-lg border border-border bg-panel/90 p-3 text-xs shadow-xl backdrop-blur"
    >
      <button
        type="button"
        onClick={toggle}
        aria-expanded
        aria-controls="map-legend"
        className="mb-2 flex w-full items-center justify-between text-[11px] font-medium tracking-wider text-muted uppercase hover:text-foreground"
      >
        Legend
        <ChevronDown className="h-3.5 w-3.5" aria-label="Collapse legend" />
      </button>
      <ul className="space-y-1.5">
        <li className="flex items-center gap-2">
          <span className="flex w-[38px] gap-0.5">
            {HUMAN_COLORS.map((c) => (
              <PathSwatch key={c} color={c} width={12} />
            ))}
          </span>
          Human, one colour per player
        </li>
        <li className="flex items-center gap-2">
          <PathSwatch color={BOT_COLOR} dashed width={38} />
          Bot (dashed)
        </li>
        <li className="flex items-center gap-2">
          <svg width={38} height={14} aria-hidden className="shrink-0">
            <circle cx={8} cy={7} r={3} fill="#0b0d10" stroke={HUMAN_COLORS[0]} strokeWidth={1.5} />
            <circle cx={28} cy={7} r={5} fill="none" stroke={HUMAN_COLORS[0]} strokeWidth={2.5} />
          </svg>
          First seen · last seen alive
        </li>
        {EVENT_TYPES.map((t) => (
          <li key={t} className="flex items-center gap-2">
            <span className="flex w-[38px] justify-center">
              <MarkerIcon type={t} />
            </span>
            {EVENT_LABELS[t]}
          </li>
        ))}
      </ul>
      <p className="mt-2 leading-snug text-muted">
        The storm front isn&apos;t in the telemetry, only storm deaths.
      </p>
    </section>
  );
}
