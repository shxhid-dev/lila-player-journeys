"use client";

import dynamic from "next/dynamic";
import { useMemo } from "react";
import { useViewState } from "@/hooks/use-view-state";
import { useManifest } from "@/lib/data";
import type { MapId } from "@/lib/maps";
import { TopBar } from "./top-bar";

const MapCanvas = dynamic(() => import("@/components/map/map-canvas"), {
  ssr: false,
  loading: () => <div className="h-full w-full animate-pulse bg-[#07080a]" />,
});

export function Explorer() {
  const [view, update] = useViewState();
  const manifest = useManifest();

  const matchCounts = useMemo(() => {
    const counts: Partial<Record<MapId, number>> = {};
    for (const m of manifest.data?.matches ?? []) counts[m.map] = (counts[m.map] ?? 0) + 1;
    return counts;
  }, [manifest.data]);

  const asset = manifest.data?.maps[view.map];

  return (
    <div className="flex h-dvh flex-col">
      <TopBar
        map={view.map}
        matchCounts={matchCounts}
        onMapChange={(map) => update({ map, matches: null, t: null })}
      />
      <main className="relative min-h-0 flex-1">
        {manifest.isError ? (
          <div className="grid h-full place-items-center text-sm text-red-300">
            Could not load telemetry data. Try reloading the page.
          </div>
        ) : asset ? (
          <MapCanvas
            mapId={view.map}
            asset={asset}
            calibration={view.calibration}
            onToggleCalibration={() => update((s) => ({ calibration: !s.calibration }))}
          />
        ) : (
          <div className="h-full w-full animate-pulse bg-[#07080a]" />
        )}
      </main>
    </div>
  );
}
