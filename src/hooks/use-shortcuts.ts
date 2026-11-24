"use client";

import { useEffect, useRef } from "react";

export type ShortcutMap = Record<string, () => void>;

function isTyping(target: EventTarget | null) {
  return (
    target instanceof HTMLElement &&
    (target.isContentEditable || ["INPUT", "SELECT", "TEXTAREA"].includes(target.tagName))
  );
}

/**
 * Global single-key shortcuts (keys are KeyboardEvent.key values). Ignored while
 * typing or with Ctrl/Cmd/Alt held, so browser shortcuts keep working. Playback
 * keys live in the timeline.
 */
export function useShortcuts(map: ShortcutMap) {
  const ref = useRef(map);
  ref.current = map;
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (isTyping(e.target) || e.metaKey || e.ctrlKey || e.altKey) return;
      const action = ref.current[e.key] ?? ref.current[e.key.toLowerCase()];
      if (!action) return;
      e.preventDefault();
      action();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);
}
