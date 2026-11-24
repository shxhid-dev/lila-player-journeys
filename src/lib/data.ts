"use client";

import { useQueries, useQuery } from "@tanstack/react-query";
import type { MapId } from "./maps";
import type { HeatPoints, Manifest, MatchShard } from "./types";

async function getJson<T>(url: string): Promise<T> {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`${res.status} ${res.statusText} for ${url}`);
  return (await res.json()) as T;
}

/** The data is static for the life of a deploy, so nothing ever goes stale. */
const STATIC = { staleTime: Infinity, gcTime: Infinity, retry: 1 } as const;

export function useManifest() {
  return useQuery({
    queryKey: ["manifest"],
    queryFn: () => getJson<Manifest>("/data/manifest.json"),
    ...STATIC,
  });
}

export function useMatches(ids: string[]) {
  return useQueries({
    queries: ids.map((id) => ({
      queryKey: ["match", id],
      queryFn: () => getJson<MatchShard>(`/data/matches/${id}.json`),
      ...STATIC,
    })),
  });
}

export function useHeatPoints(map: MapId, enabled: boolean) {
  return useQuery({
    queryKey: ["heat", map],
    queryFn: () => getJson<HeatPoints>(`/data/heat/${map}.json`),
    enabled,
    ...STATIC,
  });
}
