"use client";

import { Eye, EyeOff, Info, X } from "lucide-react";
import { useMemo } from "react";
import { PathSwatch } from "@/components/ui/marker-icon";
import { formatClock, shortId } from "@/lib/journey";
import { FLAG_NOTES, formatUtc, OUTCOME_LABELS, playerName } from "@/lib/labels";
import type { MapId } from "@/lib/maps";
import { journeyColors, journeyKey } from "@/lib/scene";
import type { MatchShard } from "@/lib/types";
import { cn } from "@/lib/utils";
import { useExplorer } from "@/store/explorer";

interface MatchPanelProps {
  mapId: MapId;
  shards: MatchShard[];
  loading: boolean;
  selectedCount: number;
  onRemove?: (matchId: string) => void;
}

function Metric({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="rounded-md bg-panel-raised px-2 py-1.5">
      <div className="text-[10px] tracking-wider text-muted uppercase">{label}</div>
      <div className="text-sm font-medium tabular-nums">{value}</div>
    </div>
  );
}

function MatchCard({
  shard,
  colors,
  onRemove,
}: {
  shard: MatchShard;
  colors: Map<string, string>;
  onRemove?: () => void;
}) {
  const hidden = useExplorer((s) => s.hidden);
  const toggleHidden = useExplorer((s) => s.toggleHidden);
  const setFocus = useExplorer((s) => s.setFocus);

  const totals = useMemo(() => {
    const t = { kills: 0, deaths: 0, storm: 0, loot: 0 };
    for (const j of shard.journeys) {
      for (const [, type] of j.events) {
        if (type === "kill") t.kills++;
        else if (type === "death") t.deaths++;
        else if (type === "storm") t.storm++;
        else t.loot++;
      }
    }
    return t;
  }, [shard]);
  const humans = shard.journeys.filter((j) => j.kind === "human");
  const flags = [
    humans.some((j) => j.idKind === "numeric") && FLAG_NOTES["numeric-id-human"],
    shard.journeys.some((j) => j.outcome === "self_elimination") && FLAG_NOTES["self-elimination"],
  ].filter(Boolean) as string[];

  return (
    <section className="space-y-3" aria-label={`Match ${shortId(shard.id)}`}>
      <header className="flex items-start gap-2">
        <div className="min-w-0">
          <h2 className="font-mono text-sm font-medium" title={shard.id}>
            Match {shortId(shard.id)}
          </h2>
          <p className="text-xs text-muted">
            {formatUtc(shard.startUtc)} UTC · {formatClock(shard.duration)} long
          </p>
        </div>
        {onRemove && (
          <button
            type="button"
            onClick={onRemove}
            className="ml-auto rounded p-1 text-muted hover:bg-panel-raised hover:text-foreground"
            aria-label={`Remove match ${shortId(shard.id)} from selection`}
          >
            <X className="h-3.5 w-3.5" />
          </button>
        )}
      </header>

      <div className="grid grid-cols-4 gap-1.5">
        <Metric label="Humans" value={humans.length} />
        <Metric label="Bots" value={shard.journeys.length - humans.length} />
        <Metric label="Kills" value={totals.kills} />
        <Metric label="Loot" value={totals.loot} />
        <Metric label="Deaths" value={totals.deaths} />
        <Metric label="Storm" value={totals.storm} />
        <Metric
          label="Survived"
          value={`${humans.filter((j) => j.outcome === "survived").length}/${humans.length}`}
        />
        <Metric label="Length" value={formatClock(shard.duration)} />
      </div>

      {flags.map((note) => (
        <p key={note} className="flex gap-1.5 text-xs leading-relaxed text-muted">
          <Info className="mt-0.5 h-3.5 w-3.5 shrink-0 text-accent" />
          {note}
        </p>
      ))}

      <table className="w-full text-xs">
        <thead className="text-[10px] tracking-wider text-muted uppercase">
          <tr>
            <th className="pb-1 text-left font-normal">Player</th>
            <th className="pb-1 text-right font-normal" title="Kills / deaths">
              K/D
            </th>
            <th className="pb-1 text-right font-normal">Loot</th>
            <th className="pb-1 text-right font-normal" title="Time alive">
              Alive
            </th>
            <th className="w-6">
              <span className="sr-only">Show on map</span>
            </th>
          </tr>
        </thead>
        <tbody>
          {shard.journeys.map((j) => {
            const key = journeyKey(shard.id, j.id);
            const isHidden = hidden.has(key);
            return (
              <tr
                key={key}
                className={cn("group tabular-nums hover:bg-panel-raised", isHidden && "opacity-40")}
                onMouseEnter={() => !isHidden && setFocus(key)}
                onMouseLeave={() => setFocus(null)}
              >
                <td className="py-1 pr-2">
                  <div className="flex items-center gap-2">
                    <PathSwatch color={colors.get(key) ?? "#888"} dashed={j.kind === "bot"} />
                    <div className="min-w-0">
                      <div className="truncate">{playerName(j)}</div>
                      <div className="text-[10px] text-muted">{OUTCOME_LABELS[j.outcome]}</div>
                    </div>
                  </div>
                </td>
                <td className="py-1 text-right">
                  {j.stats.kills}/{j.stats.deaths}
                </td>
                <td className="py-1 text-right">{j.kind === "human" ? j.stats.loot : "–"}</td>
                <td className="py-1 text-right">{formatClock(j.stats.survival)}</td>
                <td className="py-1 text-right">
                  <button
                    type="button"
                    onClick={() => toggleHidden(key)}
                    className="rounded p-0.5 text-muted hover:text-foreground"
                    aria-label={`${isHidden ? "Show" : "Hide"} ${playerName(j)}`}
                  >
                    {isHidden ? (
                      <EyeOff className="h-3.5 w-3.5" />
                    ) : (
                      <Eye className="h-3.5 w-3.5" />
                    )}
                  </button>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </section>
  );
}

export function MatchPanel({ mapId, shards, loading, selectedCount, onRemove }: MatchPanelProps) {
  const colors = useMemo(() => journeyColors(shards, mapId), [shards, mapId]);

  if (selectedCount === 0) {
    return (
      <div className="rounded-lg border border-dashed border-border p-4 text-center text-xs leading-relaxed text-muted">
        No match selected. Pick one from the match list to replay its journeys, or keep exploring
        the heatmap across every match in the filter.
      </div>
    );
  }
  if (loading && shards.length === 0) {
    return (
      <div className="space-y-2" aria-busy>
        <div className="h-5 w-32 animate-pulse rounded bg-panel-raised" />
        <div className="h-24 animate-pulse rounded bg-panel-raised" />
        <div className="h-40 animate-pulse rounded bg-panel-raised" />
      </div>
    );
  }
  return (
    <div className="space-y-6">
      {shards.map((s) => (
        <MatchCard
          key={s.id}
          shard={s}
          colors={colors}
          onRemove={onRemove && selectedCount > 1 ? () => onRemove(s.id) : undefined}
        />
      ))}
    </div>
  );
}
