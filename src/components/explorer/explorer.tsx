"use client";

import dynamic from "next/dynamic";
import { useMemo } from "react";
import { useViewState } from "@/hooks/use-view-state";
import { useManifest, useMatches } from "@/lib/data";
import type { MapId } from "@/lib/maps";
import { buildScene, pickFeaturedMatch } from "@/lib/scene";
import { useExplorer } from "@/store/explorer";
import { Legend } from "./legend";
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

  // Matches on this map within the date filter.
  const filteredMatches = useMemo(
    () =>
      (manifest.data?.matches ?? []).filter(
        (m) => m.map === view.map && (view.dates.length === 0 || view.dates.includes(m.date)),
      ),
    [manifest.data, view.map, view.dates],
  );

  const selectedIds = useMemo(() => {
    if (view.matches) return view.matches;
    const featured = pickFeaturedMatch(filteredMatches);
    return featured ? [featured.id] : [];
  }, [view.matches, filteredMatches]);

  const { shards } = useMatches(selectedIds);

  const scene = useMemo(
    () => buildScene(shards, view.map, { players: view.players, events: view.events, hidden }),
    [shards, view.map, view.players, view.events, hidden],
  );

  const asset = manifest.data?.maps[view.map];

  return (
    <div className="flex h-dvh flex-col">
      <TopBar
        map={view.map}
        matchCounts={matchCounts}
        onMapChange={(map) => update({ map, matches: null, t: null })}
      />
      <div className="flex min-h-0 flex-1">
        <main className="relative min-w-0 flex-1">
          {manifest.isError ? (
            <div className="grid h-full place-items-center text-sm text-red-300">
              Could not load telemetry data. Try reloading the page.
            </div>
          ) : asset ? (
            <MapCanvas
              mapId={view.map}
              asset={asset}
              scene={scene}
              time={scene.duration}
              calibration={view.calibration}
              onToggleCalibration={() => update((s) => ({ calibration: !s.calibration }))}
            />
          ) : (
            <div className="h-full w-full animate-pulse bg-[#07080a]" />
          )}
        </main>
        <aside className="hidden w-80 shrink-0 flex-col overflow-y-auto border-l border-border bg-panel p-4 lg:flex">
          <div className="mt-auto">
            <Legend />
          </div>
        </aside>
      </div>
    </div>
  );
}
