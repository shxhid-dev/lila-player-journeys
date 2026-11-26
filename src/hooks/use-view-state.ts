"use client";

import { useSearchParams } from "next/navigation";
import { useCallback, useMemo, useRef } from "react";
import {
  parseViewState,
  serializeViewState,
  shareViewState,
  type ViewState,
} from "@/lib/url-state";

type Patch = Partial<ViewState> | ((current: ViewState) => Partial<ViewState>);

/**
 * URL-backed view state. Writes go through history.replaceState, which Next keeps
 * in sync with useSearchParams. That avoids a router round-trip on every slider tick
 * and keeps the back button free of filter noise. Parsed arrays keep their identity
 * while their contents don't change (see shareViewState), so memoized work downstream
 * only reruns when it has to.
 */
export function useViewState() {
  const params = useSearchParams();
  const prev = useRef<ViewState | null>(null);
  const state = useMemo(() => {
    const next = shareViewState(
      prev.current,
      parseViewState(new URLSearchParams(params.toString())),
    );
    prev.current = next;
    return next;
  }, [params]);

  const update = useCallback((patch: Patch) => {
    const current = parseViewState(new URLSearchParams(window.location.search));
    const next = { ...current, ...(typeof patch === "function" ? patch(current) : patch) };
    const qs = serializeViewState(next);
    window.history.replaceState(null, "", qs ? `?${qs}` : window.location.pathname);
  }, []);

  return [state, update] as const;
}
