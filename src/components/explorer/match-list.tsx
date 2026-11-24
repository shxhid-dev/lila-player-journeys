"use client";

import { Search } from "lucide-react";
import { useMemo, useState } from "react";
import { MarkerIcon } from "@/components/ui/marker-icon";
import { SectionTitle } from "@/components/ui/toggle-chip";
import { HUMAN_COLORS } from "@/lib/colors";
import { formatClock, shortId } from "@/lib/journey";
import { formatUtc } from "@/lib/labels";
import type { MatchSummary } from "@/lib/types";
import { MAX_SELECTED_MATCHES } from "@/lib/url-state";
import { cn } from "@/lib/utils";

type SortKey = "players" | "combat" | "longest" | "newest";
const SORTS: Record<SortKey, { label: string; fn: (a: MatchSummary, b: MatchSummary) => number }> =
  {
    players: { label: "Most players", fn: (a, b) => b.humans + b.bots - (a.humans + a.bots) },
    combat: {
      label: "Most combat",
      fn: (a, b) => b.kills + b.deaths + b.storm - (a.kills + a.deaths + a.storm),
    },
    longest: { label: "Longest", fn: (a, b) => b.duration - a.duration },
    newest: { label: "Newest", fn: (a, b) => b.startUtc - a.startUtc },
  };

interface MatchListProps {
  matches: MatchSummary[];
  selected: string[];
  onSelect: (ids: string[]) => void;
  loading: boolean;
}

export function MatchList({ matches, selected, onSelect, loading }: MatchListProps) {
  const [query, setQuery] = useState("");
  const [sort, setSort] = useState<SortKey>("players");

  const rows = useMemo(() => {
    const q = query.trim().toLowerCase();
    return matches
      .filter((m) => !q || m.id.startsWith(q))
      .sort((a, b) => SORTS[sort].fn(a, b) || b.startUtc - a.startUtc);
  }, [matches, query, sort]);

  // Click selects one match. Ctrl/Cmd/Shift-click adds it to the comparison (max 3).
  const choose = (id: string, additive: boolean) => {
    if (!additive) return onSelect(selected.length === 1 && selected[0] === id ? [] : [id]);
    if (selected.includes(id)) return onSelect(selected.filter((s) => s !== id));
    onSelect([...selected, id].slice(-MAX_SELECTED_MATCHES));
  };

  return (
    <section className="flex min-h-0 flex-1 flex-col">
      <SectionTitle
        aside={<span className="text-[11px] text-muted tabular-nums">{rows.length} matches</span>}
      >
        Matches
      </SectionTitle>
      <div className="mb-2 flex gap-1.5">
        <label className="relative min-w-0 flex-1">
          <span className="sr-only">Search match ID</span>
          <Search className="pointer-events-none absolute top-1/2 left-2 h-3.5 w-3.5 -translate-y-1/2 text-muted" />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Match ID…"
            className="h-7 w-full rounded-md border border-border bg-background pr-2 pl-7 font-mono text-xs placeholder:font-sans placeholder:text-muted focus:border-accent/60 focus:outline-none"
          />
        </label>
        <label>
          <span className="sr-only">Sort matches</span>
          <select
            value={sort}
            onChange={(e) => setSort(e.target.value as SortKey)}
            className="h-7 rounded-md border border-border bg-background px-1.5 text-xs focus:border-accent/60 focus:outline-none"
          >
            {Object.entries(SORTS).map(([k, s]) => (
              <option key={k} value={k}>
                {s.label}
              </option>
            ))}
          </select>
        </label>
      </div>
      <p className="mb-2 text-[11px] leading-snug text-muted">
        Click to replay. Ctrl/⌘-click to compare up to {MAX_SELECTED_MATCHES}.
      </p>

      <ul
        className="-mx-1 min-h-0 flex-1 space-y-0.5 overflow-y-auto px-1"
        aria-label="Matches"
        aria-busy={loading}
      >
        {loading &&
          Array.from({ length: 8 }, (_, i) => (
            <li key={i} className="h-11 animate-pulse rounded-md bg-panel-raised" />
          ))}
        {!loading && rows.length === 0 && (
          <li className="rounded-md border border-dashed border-border p-4 text-center text-xs text-muted">
            No matches for these filters.
          </li>
        )}
        {rows.map((m) => {
          const index = selected.indexOf(m.id);
          const isSelected = index >= 0;
          return (
            <li key={m.id}>
              <button
                type="button"
                onClick={(e) => choose(m.id, e.ctrlKey || e.metaKey || e.shiftKey)}
                aria-pressed={isSelected}
                className={cn(
                  "group flex w-full items-center gap-2 rounded-md border px-2 py-1.5 text-left text-xs transition-colors",
                  isSelected
                    ? "border-accent/40 bg-accent/10"
                    : "border-transparent hover:bg-panel-raised",
                )}
              >
                <span
                  className="h-7 w-1 shrink-0 rounded-full"
                  style={{
                    background: isSelected ? (HUMAN_COLORS[index] ?? "#f0efec") : "transparent",
                  }}
                />
                <span className="min-w-0 flex-1">
                  <span className="flex items-center gap-2">
                    <span className="font-mono">{shortId(m.id)}</span>
                    <span className="text-muted">{formatUtc(m.startUtc)}</span>
                  </span>
                  <span className="mt-0.5 flex items-center gap-2 text-[11px] text-muted tabular-nums">
                    <span title="Duration">{formatClock(m.duration)}</span>
                    <span title="Humans / bots with telemetry">
                      {m.humans}H {m.bots}B
                    </span>
                    {m.kills > 0 && (
                      <span className="flex items-center gap-0.5" title="Kills">
                        <MarkerIcon type="kill" size={10} />
                        {m.kills}
                      </span>
                    )}
                    {m.deaths > 0 && (
                      <span className="flex items-center gap-0.5" title="Deaths">
                        <MarkerIcon type="death" size={10} />
                        {m.deaths}
                      </span>
                    )}
                    {m.storm > 0 && (
                      <span className="flex items-center gap-0.5" title="Storm deaths">
                        <MarkerIcon type="storm" size={10} />
                        {m.storm}
                      </span>
                    )}
                  </span>
                </span>
              </button>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
