"use client";

import { MAP_IDS, MAPS, type MapId } from "@/lib/maps";
import { cn } from "@/lib/utils";

interface TopBarProps {
  map: MapId;
  matchCounts: Partial<Record<MapId, number>>;
  onMapChange: (map: MapId) => void;
  actions?: React.ReactNode;
}

export function TopBar({ map, matchCounts, onMapChange, actions }: TopBarProps) {
  return (
    // On narrow screens the map switcher drops to its own full-width row.
    <header className="flex min-h-12 shrink-0 flex-wrap items-center gap-x-4 gap-y-1.5 border-b border-border bg-panel px-4 py-1.5 md:flex-nowrap md:py-0">
      <div className="flex items-baseline gap-2 whitespace-nowrap">
        <span className="text-sm font-semibold tracking-[0.18em]">LILA BLACK</span>
        <span className="hidden text-sm text-muted lg:inline">Player Journeys</span>
      </div>

      <nav
        aria-label="Map"
        className="order-last flex w-full rounded-md border border-border p-0.5 md:order-none md:w-auto"
      >
        {MAP_IDS.map((id) => (
          <button
            key={id}
            type="button"
            onClick={() => onMapChange(id)}
            aria-current={id === map ? "page" : undefined}
            className={cn(
              "min-w-0 flex-1 truncate rounded px-2 py-1 text-sm whitespace-nowrap transition-colors sm:px-3 md:flex-none",
              id === map ? "bg-panel-raised text-foreground" : "text-muted hover:text-foreground",
            )}
          >
            <span className="sm:hidden">{MAPS[id].short}</span>
            <span className="hidden sm:inline">{MAPS[id].label}</span>
            {matchCounts[id] !== undefined && (
              <span className="ml-1.5 hidden text-xs text-muted tabular-nums sm:inline">
                {matchCounts[id]}
              </span>
            )}
          </button>
        ))}
      </nav>

      <div className="ml-auto flex shrink-0 items-center gap-0.5 sm:gap-1">{actions}</div>
    </header>
  );
}
