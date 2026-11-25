"use client";

import * as Slider from "@radix-ui/react-slider";
import { SectionTitle, ToggleChip } from "@/components/ui/toggle-chip";
import { HEAT_RAMP } from "@/lib/colors";
import type { HeatGrid } from "@/lib/heatmap";
import { HEAT_LAYERS, HEAT_PHASES, type HeatLayer, type HeatPhase } from "@/lib/types";
import { HEAT_BINS, type ViewState } from "@/lib/url-state";
import { cn } from "@/lib/utils";

/** Single-choice button group. aria-pressed marks the active option. */
function Segmented<T extends string>({
  label,
  value,
  options,
  onChange,
}: {
  label: string;
  value: T;
  options: [T, string][];
  onChange: (value: T) => void;
}) {
  return (
    <div className="flex rounded-md border border-border p-0.5" role="group" aria-label={label}>
      {options.map(([key, text]) => (
        <button
          key={key}
          type="button"
          aria-pressed={value === key}
          onClick={() => onChange(key)}
          className={cn(
            "flex-1 rounded px-1.5 py-1 whitespace-nowrap",
            value === key ? "bg-panel-raised text-foreground" : "text-muted hover:text-foreground",
          )}
        >
          {text}
        </button>
      ))}
    </div>
  );
}

export const HEAT_LABELS: Record<HeatLayer, string> = {
  traffic: "Traffic",
  kills: "Kills",
  deaths: "Deaths",
  storm: "Storm deaths",
  loot: "Loot",
};

interface HeatmapControlsProps {
  view: ViewState;
  update: (patch: Partial<ViewState>) => void;
  grid: HeatGrid | null;
  loading: boolean;
  filteredCount: number;
  selectedCount: number;
}

export function HeatmapControls({
  view,
  update,
  grid,
  loading,
  filteredCount,
  selectedCount,
}: HeatmapControlsProps) {
  const on = view.heat !== null;
  return (
    <section>
      <SectionTitle aside={<kbd className="text-[10px] text-muted">H</kbd>}>Heatmap</SectionTitle>
      <div className="flex flex-wrap gap-1.5">
        <ToggleChip pressed={!on} onClick={() => update({ heat: null })}>
          Off
        </ToggleChip>
        {HEAT_LAYERS.map((l) => (
          <ToggleChip key={l} pressed={view.heat === l} onClick={() => update({ heat: l })}>
            {HEAT_LABELS[l]}
          </ToggleChip>
        ))}
      </div>

      {on && (
        <div className="mt-3 space-y-3 text-xs">
          <Segmented
            label="Heatmap scope"
            value={view.heatScope}
            onChange={(heatScope) => update({ heatScope })}
            options={[
              ["filtered", `All filtered (${filteredCount})`],
              ["selected", `Selected (${selectedCount})`],
            ]}
          />

          <div>
            <span className="mb-1.5 block text-muted">Match phase</span>
            <Segmented
              label="Match phase"
              value={view.heatPhase}
              onChange={(heatPhase) => update({ heatPhase })}
              options={(Object.keys(HEAT_PHASES) as HeatPhase[]).map((p) => [
                p,
                p === "all" ? "All" : HEAT_PHASES[p].label,
              ])}
            />
          </div>

          <label className="block">
            <span className="mb-1.5 flex justify-between text-muted">
              Opacity <span className="tabular-nums">{Math.round(view.heatOpacity * 100)}%</span>
            </span>
            <Slider.Root
              className="relative flex h-4 touch-none items-center select-none"
              min={0.1}
              max={1}
              step={0.05}
              value={[view.heatOpacity]}
              onValueChange={([v]) => update({ heatOpacity: Math.round(v * 100) / 100 })}
              aria-label="Heatmap opacity"
            >
              <Slider.Track className="relative h-1 grow rounded-full bg-panel-raised">
                <Slider.Range className="absolute h-full rounded-full bg-accent/60" />
              </Slider.Track>
              <Slider.Thumb
                aria-label="Heatmap opacity"
                className="block h-3.5 w-3.5 rounded-full border-2 border-accent bg-background focus-visible:ring-2 focus-visible:ring-accent/60 focus-visible:outline-none"
              />
            </Slider.Root>
          </label>

          <div>
            <div
              className="h-2 rounded-full"
              style={{ background: `linear-gradient(90deg, transparent, ${HEAT_RAMP.join(", ")})` }}
              aria-hidden
            />
            <div className="mt-1 flex justify-between text-[10px] text-muted">
              <span>fewer</span>
              <span>log scale, top 1% clipped</span>
              <span>more</span>
            </div>
          </div>

          <p className="text-muted tabular-nums">
            {loading
              ? "Loading points…"
              : grid
                ? `${grid.total.toLocaleString()} ${view.heat === "traffic" ? "position samples" : "events"}`
                : "Nothing to show for this scope."}
            {view.heat === "traffic" && view.players.includes("bot") && (
              <> · bot movement exists for 52 of 796 matches only</>
            )}
          </p>

          <details className="group">
            <summary className="cursor-pointer text-muted select-none hover:text-foreground">
              Advanced
            </summary>
            <label className="mt-2 flex items-center justify-between gap-2">
              <span className="text-muted">Bin size</span>
              <select
                value={view.heatBin}
                onChange={(e) => update({ heatBin: Number(e.target.value) })}
                className="h-7 rounded-md border border-border bg-background px-1.5"
              >
                {HEAT_BINS.map((b) => (
                  <option key={b} value={b}>
                    {b}px ({Math.round(1024 / b)}×{Math.round(1024 / b)} grid)
                  </option>
                ))}
              </select>
            </label>
          </details>
        </div>
      )}
    </section>
  );
}
