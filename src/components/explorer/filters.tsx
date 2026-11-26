"use client";

import { MarkerIcon, PathSwatch } from "@/components/ui/marker-icon";
import { SectionTitle, ToggleChip } from "@/components/ui/toggle-chip";
import { BOT_COLOR, EVENT_STYLES, HUMAN_COLORS } from "@/lib/colors";
import { EVENT_TYPES, type MatchSummary, type PlayerKind } from "@/lib/types";
import type { ViewState } from "@/lib/url-state";

interface FiltersProps {
  view: ViewState;
  dates: string[];
  mapMatches: MatchSummary[];
  update: (patch: Partial<ViewState>) => void;
}

const toggle = <T,>(list: readonly T[], item: T) =>
  list.includes(item) ? list.filter((x) => x !== item) : [...list, item];

export const dayLabel = (d: string) =>
  new Date(`${d}T00:00:00Z`).toLocaleDateString("en-GB", {
    timeZone: "UTC",
    day: "numeric",
    month: "short",
  });

const PARTIAL_DAY = "2026-02-14";

export function Filters({ view, dates, mapMatches, update }: FiltersProps) {
  const perDate = new Map<string, number>();
  for (const m of mapMatches) perDate.set(m.date, (perDate.get(m.date) ?? 0) + 1);

  // Empty means "all dates". Clicking a chip while all are on isolates that day.
  const toggleDate = (d: string) => {
    // Switching off the only selected day would silently mean "all dates"; keep it
    // instead. "All dates" has its own button.
    if (view.dates.length === 1 && view.dates[0] === d) return;
    const next = view.dates.length === 0 ? [d] : toggle(view.dates, d);
    update({ dates: next.length === dates.length ? [] : next });
  };

  return (
    <div className="space-y-4">
      <section>
        <SectionTitle
          aside={
            view.dates.length > 0 && (
              <button
                type="button"
                className="text-[11px] text-muted hover:text-foreground"
                onClick={() => update({ dates: [] })}
              >
                All dates
              </button>
            )
          }
        >
          Date (UTC)
        </SectionTitle>
        <div className="flex flex-wrap gap-1.5">
          {dates.map((d) => (
            <ToggleChip
              key={d}
              pressed={view.dates.length === 0 || view.dates.includes(d)}
              count={perDate.get(d) ?? 0}
              onClick={() => toggleDate(d)}
              title={d === PARTIAL_DAY ? "Partial day: collection stopped at 15:01 UTC" : undefined}
            >
              {dayLabel(d)}
              {d === PARTIAL_DAY && "*"}
            </ToggleChip>
          ))}
        </div>
      </section>

      <section>
        <SectionTitle>Players</SectionTitle>
        <div className="flex flex-wrap gap-1.5">
          {(["human", "bot"] as PlayerKind[]).map((k) => (
            <ToggleChip
              key={k}
              pressed={view.players.includes(k)}
              onClick={() => update({ players: toggle(view.players, k) })}
              icon={
                <PathSwatch
                  color={k === "human" ? HUMAN_COLORS[0] : BOT_COLOR}
                  dashed={k === "bot"}
                  width={16}
                />
              }
            >
              {k === "human" ? "Humans" : "Bots"}
            </ToggleChip>
          ))}
        </div>
      </section>

      <section>
        <SectionTitle>Events</SectionTitle>
        <div className="flex flex-wrap gap-1.5">
          {EVENT_TYPES.map((t) => (
            <ToggleChip
              key={t}
              pressed={view.events.includes(t)}
              onClick={() => update({ events: toggle(view.events, t) })}
              icon={<MarkerIcon type={t} size={12} />}
            >
              {EVENT_STYLES[t].label}
            </ToggleChip>
          ))}
        </div>
      </section>
    </div>
  );
}
