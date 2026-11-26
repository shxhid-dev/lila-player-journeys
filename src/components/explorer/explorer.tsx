"use client";

import { CircleHelp, Download, Link2, PanelRight, SlidersHorizontal } from "lucide-react";
import dynamic from "next/dynamic";
import { useEffect, useMemo, useRef, useState } from "react";
import { preload } from "react-dom";
import { Button } from "@/components/ui/button";
import { useShortcuts } from "@/hooks/use-shortcuts";
import { useViewState } from "@/hooks/use-view-state";
import { useHeatPoints, useManifest, useMatches } from "@/lib/data";
import { exportStagePng } from "@/lib/export";
import { binPoints, selectHeatPoints, shardHeatPoints } from "@/lib/heatmap";
import { shortId } from "@/lib/journey";
import { MAPS, minimapUrl, type MapId } from "@/lib/maps";
import { listMatches, stepMatch, type SortKey } from "@/lib/match-list";
import { serializeViewState } from "@/lib/url-state";
import { buildScene, journeyColors, journeyKey, pickFeaturedMatch } from "@/lib/scene";
import { HEAT_LAYERS } from "@/lib/types";
import { cn } from "@/lib/utils";
import { useExplorer } from "@/store/explorer";
import { Filters } from "./filters";
import { HEAT_LABELS, HeatmapControls } from "./heatmap-controls";
import { MapLegend } from "./legend";
import { MatchList } from "./match-list";
import { MatchPanel } from "./match-panel";
import { Timeline } from "./timeline";
import { TopBar } from "./top-bar";

// The help dialog (and Radix Dialog) only loads the first time it's opened.
const HelpDialog = dynamic(() => import("./help-dialog").then((m) => m.HelpDialog), {
  ssr: false,
});

const MapCanvas = dynamic(() => import("@/components/map/map-canvas"), {
  ssr: false,
  loading: () => <div className="h-full w-full animate-pulse bg-[#07080a]" />,
});

/**
 * Mirrors the paused playback position into the URL (debounced) so a link reproduces
 * the moment. It's its own component so that only it, not the whole page, re-renders
 * as the clock ticks.
 */
function PlaybackUrlSync({
  duration,
  ready,
  urlTime,
  update,
}: {
  duration: number;
  ready: boolean;
  urlTime: React.RefObject<number | null>;
  update: (patch: { t: number | null }) => void;
}) {
  const time = useExplorer((s) => s.time);
  const playing = useExplorer((s) => s.playing);
  useEffect(() => {
    if (playing || !ready || duration === 0) return;
    const id = setTimeout(() => {
      const t = time >= duration ? null : Math.floor(time);
      if (t !== urlTime.current) update({ t });
    }, 250);
    return () => clearTimeout(id);
  }, [time, playing, ready, duration, urlTime, update]);
  return null;
}

export function Explorer() {
  const [view, update] = useViewState();
  // Start the minimap download right away, in parallel with the manifest and canvas code.
  preload(minimapUrl(view.map), { as: "image", fetchPriority: "high" });
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
  // Only dates that exist in the data count. A stale or hand-edited date must not fall
  // back to "all dates" in one place (the heatmap) and "no matches" in another (the list).
  const dates = useMemo(() => {
    const known = manifest.data?.dates;
    return known ? view.dates.filter((d) => known.includes(d)) : view.dates;
  }, [view.dates, manifest.data]);
  const unknownDatesOnly = view.dates.length > 0 && dates.length === 0 && !!manifest.data;
  // Matches on this map within the date filter.
  const filteredMatches = useMemo(
    () =>
      unknownDatesOnly
        ? []
        : mapMatches.filter((m) => dates.length === 0 || dates.includes(m.date)),
    [mapMatches, dates, unknownDatesOnly],
  );

  // Selection: explicit ids from the URL that exist on this map, or the featured match.
  // Ids from another map or unknown to the manifest are dropped instead of loading a
  // card for the wrong map or a 404.
  const requestedIds = view.matches;
  const selectedIds = useMemo(() => {
    if (requestedIds) {
      if (!manifest.data) return requestedIds;
      const onMap = new Set(mapMatches.map((m) => m.id));
      return requestedIds.filter((id) => onMap.has(id));
    }
    const featured = pickFeaturedMatch(filteredMatches);
    return featured ? [featured.id] : [];
  }, [requestedIds, manifest.data, mapMatches, filteredMatches]);
  const droppedSelection =
    !!manifest.data && !!requestedIds && requestedIds.length > 0 && selectedIds.length === 0;

  const { shards, isLoading: shardsLoading, isError: shardsError } = useMatches(selectedIds);

  const scene = useMemo(
    () => buildScene(shards, view.map, { players: view.players, events: view.events, hidden }),
    [shards, view.map, view.players, view.events, hidden],
  );

  // Playback clock. A new selection opens on the URL's t (shared link) or the full match.
  // It waits until every selected shard has loaded, so a compare link's t isn't clamped
  // to whichever match happened to arrive first.
  const selectionKey = `${view.map}|${selectedIds.join(",")}`;
  const urlTime = useRef(view.t);
  urlTime.current = view.t;
  const [initialisedFor, setInitialisedFor] = useState<string | null>(null);
  useEffect(() => {
    if (shardsLoading || initialisedFor === selectionKey) return;
    setInitialisedFor(selectionKey);
    const { setTime, setPlaying, setFocus, setHover } = useExplorer.getState();
    setPlaying(false);
    setFocus(null);
    setHover(null);
    const t = urlTime.current;
    setTime(t !== null && t < scene.duration ? t : scene.duration);
  }, [selectionKey, shardsLoading, scene.duration, initialisedFor]);

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
        view.heatPhase,
      );
    } else if (heatQuery.data && manifest.data) {
      if (unknownDatesOnly) return null;
      const allDates = manifest.data.dates;
      points = selectHeatPoints(heatQuery.data, {
        layer: view.heat,
        players: view.players,
        dateIdx: dates.map((d) => allDates.indexOf(d)),
        phase: view.heatPhase,
      });
    } else return null;
    return points.length ? binPoints(points, view.map, view.heatBin) : null;
  }, [
    view.heat,
    view.heatScope,
    view.heatBin,
    view.heatPhase,
    view.map,
    view.players,
    dates,
    unknownDatesOnly,
    shards,
    heatQuery.data,
    manifest.data,
  ]);

  const asset = manifest.data?.maps[view.map];

  // Tab title names the view, so several shared links stay tellable apart.
  useEffect(() => {
    const parts = [MAPS[view.map].label];
    if (selectedIds.length === 1) parts.push(`Match ${shortId(selectedIds[0])}`);
    else if (selectedIds.length > 1) parts.push(`${selectedIds.length} matches`);
    if (view.heat) parts.push(`${HEAT_LABELS[view.heat]} heatmap`);
    document.title = `${parts.join(" · ")} | LILA BLACK Player Journeys`;
  }, [view.map, view.heat, selectedIds]);

  // A short hint on the canvas when the current settings draw nothing at all.
  const canvasHint = (() => {
    if (!manifest.data || shardsLoading) return null;
    if (unknownDatesOnly)
      return "The dates in this link aren't in the dataset (10–14 Feb 2026). Pick dates in the filters.";
    if (droppedSelection)
      return `The match in this link isn't on ${MAPS[view.map].label}. Pick one from the match list.`;
    if (shardsError) return "Couldn't load this match's data. Check your connection and reload.";
    if (view.heat && !heatGrid && !heatQuery.isLoading)
      return "No points for this heatmap with the current filters. Try another phase, date or player type.";
    if (view.heat) return null;
    if (selectedIds.length === 0)
      return "No match selected. Pick one from the match list, or turn on a heatmap (H) to see every filtered match.";
    if (scene.journeys.length === 0)
      return "Every player is hidden by the Players filter or the player list.";
    return null;
  })();

  // Below the md / lg breakpoints the side panels become drawers.
  // Opening one moves focus into it; Escape or closing returns focus to the button
  // that opened it, so keyboard and screen-reader users never end up on <body>.
  const [drawer, setDrawer] = useState<"filters" | "match" | null>(null);
  const drawerOpener = useRef<HTMLElement | null>(null);
  const toggleDrawer = (d: "filters" | "match") => {
    if (drawer !== d) drawerOpener.current = document.activeElement as HTMLElement | null;
    setDrawer((cur) => (cur === d ? null : d));
  };
  const prevDrawer = useRef(drawer);
  useEffect(() => {
    const was = prevDrawer.current;
    prevDrawer.current = drawer;
    if (drawer) {
      document.getElementById(drawer === "filters" ? "filters-panel" : "match-panel")?.focus();
      const onKey = (e: KeyboardEvent) => e.key === "Escape" && setDrawer(null);
      window.addEventListener("keydown", onKey);
      return () => window.removeEventListener("keydown", onKey);
    }
    if (was) drawerOpener.current?.focus();
  }, [drawer]);

  // Each selected match's stripe in the list uses its first human's actual path colour.
  const stripeColors = useMemo(() => {
    const colors = journeyColors(shards, view.map);
    const out: Record<string, string> = {};
    for (const s of shards) {
      const human = s.journeys.find((j) => j.kind === "human");
      const c = human && colors.get(journeyKey(s.id, human.id));
      if (c) out[s.id] = c;
    }
    return out;
  }, [shards, view.map]);

  // Match list order is shared by the list and the N / P keys.
  const [listQuery, setListQuery] = useState("");
  const [listSort, setListSort] = useState<SortKey>("players");
  const listRows = useMemo(
    () => listMatches(filteredMatches, listQuery, listSort),
    [filteredMatches, listQuery, listSort],
  );
  const goToMatch = (step: 1 | -1) => {
    const next = stepMatch(listRows, selectedIds[0], step);
    if (next && next.id !== selectedIds[0]) update({ matches: [next.id], t: null });
  };

  // Share, export, help and global shortcuts.
  const [helpOpen, setHelpOpen] = useState(false);
  const [toast, setToast] = useState<string | null>(null);
  useEffect(() => {
    if (!toast) return;
    const id = setTimeout(() => setToast(null), 2000);
    return () => clearTimeout(id);
  }, [toast]);

  // The link uses the live playback time, not the debounced URL value, so copying
  // mid-playback shares the moment on screen.
  const copyLink = () => {
    const now = useExplorer.getState().time;
    const t = scene.duration === 0 || now >= scene.duration ? null : Math.floor(now);
    const qs = serializeViewState({ ...view, t });
    const url = `${window.location.origin}${window.location.pathname}${qs ? `?${qs}` : ""}`;
    navigator.clipboard
      .writeText(url)
      .then(() => setToast("Link to this view copied"))
      .catch(() => setToast("Couldn't access the clipboard. Copy the address bar instead."));
  };
  const exportPng = () => {
    const stage = useExplorer.getState().stage;
    if (!stage) return;
    const tag = selectedIds.length ? selectedIds.map((id) => id.slice(0, 8)).join("+") : "all";
    const t = Math.floor(useExplorer.getState().time);
    exportStagePng(stage, `lila-${view.map}-${tag}-t${t}.png`);
    setToast("PNG exported");
  };

  useShortcuts({
    "?": () => setHelpOpen(true),
    h: () =>
      update((s) => {
        const order = [null, ...HEAT_LAYERS] as const;
        return { heat: order[(order.indexOf(s.heat) + 1) % order.length] };
      }),
    g: () => update((s) => ({ calibration: !s.calibration })),
    "0": () => useExplorer.getState().fit(),
    "+": () => useExplorer.getState().zoomBy(1.4),
    "=": () => useExplorer.getState().zoomBy(1.4),
    "-": () => useExplorer.getState().zoomBy(1 / 1.4),
    e: exportPng,
    l: copyLink,
    n: () => goToMatch(1),
    p: () => goToMatch(-1),
  });

  return (
    <div className="flex h-dvh flex-col overflow-hidden">
      <TopBar
        map={view.map}
        matchCounts={matchCounts}
        onMapChange={(map) => update({ map, matches: null, t: null })}
        actions={
          <>
            <Button
              variant="ghost"
              size="sm"
              className="md:hidden"
              active={drawer === "filters"}
              onClick={() => toggleDrawer("filters")}
              aria-expanded={drawer === "filters"}
              aria-controls="filters-panel"
            >
              <SlidersHorizontal className="h-3.5 w-3.5" />
              <span className="sr-only sm:not-sr-only">Filters</span>
            </Button>
            <Button
              variant="ghost"
              size="sm"
              className="lg:hidden"
              active={drawer === "match"}
              onClick={() => toggleDrawer("match")}
              aria-expanded={drawer === "match"}
              aria-controls="match-panel"
            >
              <PanelRight className="h-3.5 w-3.5" />
              <span className="sr-only sm:not-sr-only">Match</span>
            </Button>
            <Button variant="ghost" size="sm" onClick={copyLink} title="Copy link to this view (L)">
              <Link2 className="h-3.5 w-3.5" />
              <span className="hidden sm:inline">Copy link</span>
            </Button>
            <Button variant="ghost" size="sm" onClick={exportPng} title="Export view as PNG (E)">
              <Download className="h-3.5 w-3.5" />
              <span className="hidden sm:inline">Export PNG</span>
            </Button>
            <Button
              variant="ghost"
              size="icon"
              onClick={() => setHelpOpen(true)}
              aria-label="Help and keyboard shortcuts (?)"
              title="Help and keyboard shortcuts (?)"
            >
              <CircleHelp className="h-4 w-4" />
            </Button>
          </>
        }
      />
      {helpOpen && <HelpDialog open onOpenChange={setHelpOpen} />}
      {toast && (
        <div
          role="status"
          className="fixed bottom-20 left-1/2 z-50 -translate-x-1/2 rounded-md border border-border bg-panel-raised px-3 py-2 text-sm shadow-lg"
        >
          {toast}
        </div>
      )}
      <div className="relative flex min-h-0 flex-1">
        {drawer && (
          <button
            type="button"
            aria-label="Close panel"
            onClick={() => setDrawer(null)}
            className={cn(
              "absolute inset-0 z-20 bg-black/50",
              drawer === "filters" ? "md:hidden" : "lg:hidden",
            )}
          />
        )}
        <aside
          id="filters-panel"
          tabIndex={-1}
          aria-label="Filters and matches"
          className={cn(
            "focus:outline-none",
            "absolute inset-y-0 left-0 z-30 w-72 max-w-[85vw] shrink-0 flex-col gap-4 overflow-y-auto border-r border-border bg-panel p-4 shadow-2xl",
            "md:static md:z-auto md:flex md:max-w-none md:shadow-none",
            drawer === "filters" ? "flex" : "hidden",
          )}
        >
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
            rows={listRows}
            query={listQuery}
            onQueryChange={setListQuery}
            sort={listSort}
            onSortChange={setListSort}
            selected={selectedIds}
            stripeColors={stripeColors}
            onSelect={(ids) => {
              update({ matches: ids, t: null });
              setDrawer(null);
            }}
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
                heat={heatGrid ? { grid: heatGrid, opacity: view.heatOpacity } : null}
                hint={canvasHint}
                calibration={view.calibration}
                onToggleCalibration={() => update((s) => ({ calibration: !s.calibration }))}
              />
            ) : (
              <div className="h-full w-full animate-pulse bg-[#07080a]" />
            )}
            {asset && <MapLegend />}
          </div>
          <Timeline scene={scene} />
          <PlaybackUrlSync
            duration={scene.duration}
            ready={!shardsLoading && initialisedFor === selectionKey}
            urlTime={urlTime}
            update={update}
          />
        </main>
        <aside
          id="match-panel"
          tabIndex={-1}
          aria-label="Match details"
          className={cn(
            "focus:outline-none",
            "absolute inset-y-0 right-0 z-30 w-80 max-w-[90vw] shrink-0 flex-col gap-6 overflow-y-auto border-l border-border bg-panel p-4 shadow-2xl",
            "lg:static lg:z-auto lg:flex lg:max-w-none lg:shadow-none",
            drawer === "match" ? "flex" : "hidden",
          )}
        >
          <MatchPanel
            mapId={view.map}
            shards={shards}
            loading={shardsLoading}
            selectedCount={selectedIds.length}
            onRemove={(id) => update({ matches: selectedIds.filter((m) => m !== id) })}
          />
        </aside>
      </div>
    </div>
  );
}
