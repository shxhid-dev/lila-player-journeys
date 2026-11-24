"use client";

import { useSearchParams } from "next/navigation";
import { useCallback, useMemo } from "react";
import { parseViewState, serializeViewState, type ViewState } from "@/lib/url-state";

type Patch = Partial<ViewState> | ((current: ViewState) => Partial<ViewState>);

/**
 * URL-backed view state. Writes go through history.replaceState, which Next keeps
 * in sync with useSearchParams. That avoids a router round-trip on every slider tick
 * and keeps the back button free of filter noise.
 */
export function useViewState() {
  const params = useSearchParams();
  const state = useMemo(() => parseViewState(new URLSearchParams(params.toString())), [params]);

  const update = useCallback((patch: Patch) => {
    const current = parseViewState(new URLSearchParams(window.location.search));
    const next = { ...current, ...(typeof patch === "function" ? patch(current) : patch) };
    const qs = serializeViewState(next);
    window.history.replaceState(null, "", qs ? `?${qs}` : window.location.pathname);
  }, []);

  return [state, update] as const;
}
