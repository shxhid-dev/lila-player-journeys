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
    <header className="flex h-12 shrink-0 items-center gap-4 border-b border-border bg-panel px-4">
      <div className="flex items-baseline gap-2">
        <span className="text-sm font-semibold tracking-[0.18em]">LILA BLACK</span>
        <span className="hidden text-sm text-muted sm:inline">Player Journeys</span>
      </div>

      <nav aria-label="Map" className="flex rounded-md border border-border p-0.5">
        {MAP_IDS.map((id) => (
          <button
            key={id}
            type="button"
            onClick={() => onMapChange(id)}
            aria-current={id === map ? "page" : undefined}
            className={cn(
              "rounded px-3 py-1 text-sm transition-colors",
              id === map ? "bg-panel-raised text-foreground" : "text-muted hover:text-foreground",
            )}
          >
            {MAPS[id].label}
            {matchCounts[id] !== undefined && (
              <span className="ml-1.5 text-xs text-muted tabular-nums">{matchCounts[id]}</span>
            )}
          </button>
        ))}
      </nav>

      <div className="ml-auto flex items-center gap-1">{actions}</div>
    </header>
  );
}
