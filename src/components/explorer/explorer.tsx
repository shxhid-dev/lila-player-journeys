"use client";

import dynamic from "next/dynamic";
import { useEffect, useMemo, useRef } from "react";
import { useViewState } from "@/hooks/use-view-state";
import { useHeatPoints, useManifest, useMatches } from "@/lib/data";
import { binPoints, selectHeatPoints, shardHeatPoints } from "@/lib/heatmap";
import type { MapId } from "@/lib/maps";
import { buildScene, pickFeaturedMatch } from "@/lib/scene";
import { useExplorer } from "@/store/explorer";
import { Filters } from "./filters";
import { HeatmapControls } from "./heatmap-controls";
import { Legend } from "./legend";
import { MatchList } from "./match-list";
import { MatchPanel } from "./match-panel";
import { Timeline } from "./timeline";
import { TopBar } from "./top-bar";

const MapCanvas = dynamic(() => import("@/components/map/map-canvas"), {
  ssr: false,
  loading: () => <div className="h-full w-full animate-pulse bg-[#07080a]" />,
});

export function Explorer() {
  const [view, update] = useViewState();
  const manifest = useManifest();
  const hidden = useExplorer((s) => s.hidden);

  const matchCounts = useMemo(() => {
    const counts: Partial<Record<MapId, number>> = {};
    for (const m of manifest.data?.matches ?? []) counts[m.map] = (counts[m.map] ?? 0) + 1;
    return counts;
  }, [manifest.data]);

  const mapMatches = useMemo(
    () => (manifest.data?.matches ?? []).filter((m) => m.map === view.map),
    [manifest.data, view.map],
  );
  // Matches on this map within the date filter.
  const filteredMatches = useMemo(
    () => mapMatches.filter((m) => view.dates.length === 0 || view.dates.includes(m.date)),
    [mapMatches, view.dates],
  );

  const selectedIds = useMemo(() => {
    if (view.matches) return view.matches;
    const featured = pickFeaturedMatch(filteredMatches);
    return featured ? [featured.id] : [];
  }, [view.matches, filteredMatches]);

  const { shards, isLoading: shardsLoading } = useMatches(selectedIds);

  const scene = useMemo(
    () => buildScene(shards, view.map, { players: view.players, events: view.events, hidden }),
    [shards, view.map, view.players, view.events, hidden],
  );

  // Playback clock. A new selection opens on the URL's t (shared link) or the full match.
  const time = useExplorer((s) => s.time);
  const playing = useExplorer((s) => s.playing);
  const selectionKey = `${view.map}|${selectedIds.join(",")}|${scene.duration}`;
  const urlTime = useRef(view.t);
  urlTime.current = view.t;
  useEffect(() => {
    const { setTime, setPlaying } = useExplorer.getState();
    setPlaying(false);
    const t = urlTime.current;
    setTime(t !== null && t < scene.duration ? t : scene.duration);
  }, [selectionKey, scene.duration]);

  // Mirror the paused position into the URL (debounced) so a link reproduces the moment.
  useEffect(() => {
    if (playing || scene.duration === 0) return;
    const id = setTimeout(() => {
      const t = time >= scene.duration ? null : Math.floor(time);
      if (t !== urlTime.current) update({ t });
    }, 250);
    return () => clearTimeout(id);
  }, [time, playing, scene.duration, update]);

  // Heatmap: aggregate over every filtered match (pre-built per-map points) or only
  // the selected matches (computed from their shards). Binning is pure; the canvas
  // render happens inside the client-only map.
  const heatQuery = useHeatPoints(view.map, view.heat !== null && view.heatScope === "filtered");
  const heatGrid = useMemo(() => {
    if (!view.heat) return null;
    let points;
    if (view.heatScope === "selected") {
      points = shardHeatPoints(
        shards.filter((s) => s.map === view.map),
        view.heat,
        view.players,
      );
    } else if (heatQuery.data && manifest.data) {
      const allDates = manifest.data.dates;
      points = selectHeatPoints(heatQuery.data, {
        layer: view.heat,
        players: view.players,
        dateIdx: view.dates.map((d) => allDates.indexOf(d)).filter((i) => i >= 0),
      });
    } else return null;
    return points.length ? binPoints(points, view.map, view.heatBin) : null;
  }, [
    view.heat,
    view.heatScope,
    view.heatBin,
    view.map,
    view.players,
    view.dates,
    shards,
    heatQuery.data,
    manifest.data,
  ]);

  const asset = manifest.data?.maps[view.map];

  return (
    <div className="flex h-dvh flex-col">
      <TopBar
        map={view.map}
        matchCounts={matchCounts}
        onMapChange={(map) => update({ map, matches: null, t: null })}
      />
      <div className="flex min-h-0 flex-1">
        <aside className="hidden w-72 shrink-0 flex-col gap-4 overflow-y-auto border-r border-border bg-panel p-4 md:flex">
          <Filters
            view={view}
            dates={manifest.data?.dates ?? []}
            mapMatches={mapMatches}
            update={update}
          />
          <HeatmapControls
            view={view}
            update={update}
            grid={heatGrid}
            loading={heatQuery.isLoading}
            filteredCount={filteredMatches.length}
            selectedCount={selectedIds.length}
          />
          <MatchList
            matches={filteredMatches}
            selected={selectedIds}
            onSelect={(ids) => update({ matches: ids, t: null })}
            loading={manifest.isLoading}
          />
        </aside>
        <main className="flex min-w-0 flex-1 flex-col">
          <div className="relative min-h-0 flex-1">
            {manifest.isError ? (
              <div className="grid h-full place-items-center text-sm text-red-300">
                Could not load telemetry data. Try reloading the page.
              </div>
            ) : asset ? (
              <MapCanvas
                mapId={view.map}
                asset={asset}
                scene={scene}
                time={time}
                heat={heatGrid ? { grid: heatGrid, opacity: view.heatOpacity } : null}
                calibration={view.calibration}
                onToggleCalibration={() => update((s) => ({ calibration: !s.calibration }))}
              />
            ) : (
              <div className="h-full w-full animate-pulse bg-[#07080a]" />
            )}
          </div>
          <Timeline scene={scene} />
        </main>
        <aside className="hidden w-80 shrink-0 flex-col gap-6 overflow-y-auto border-l border-border bg-panel p-4 lg:flex">
          <MatchPanel
            mapId={view.map}
            shards={shards}
            loading={shardsLoading}
            selectedCount={selectedIds.length}
            onRemove={(id) => update({ matches: selectedIds.filter((m) => m !== id) })}
          />
          <div className="mt-auto border-t border-border pt-4">
            <Legend />
          </div>
        </aside>
      </div>
    </div>
  );
}
