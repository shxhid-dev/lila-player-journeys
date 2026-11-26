"use client";

import { useEffect, useRef } from "react";

export type ShortcutMap = Record<string, () => void>;

const SLIDER_KEYS = new Set([
  "ArrowLeft",
  "ArrowRight",
  "ArrowUp",
  "ArrowDown",
  "Home",
  "End",
  "PageUp",
  "PageDown",
]);

/**
 * Should a global shortcut stand aside for this key press? Yes when:
 * - another handler already took it, or a browser/OS modifier is held;
 * - the user is typing in a field;
 * - focus is inside a dialog (the help overlay owns the keyboard while open);
 * - a slider has focus and the key is one the slider uses itself;
 * - Space or Enter would activate a keyboard-focused button, link or disclosure.
 */
export function shouldIgnoreShortcut(e: KeyboardEvent): boolean {
  if (e.defaultPrevented || e.metaKey || e.ctrlKey || e.altKey) return true;
  const target = e.target;
  if (!(target instanceof HTMLElement)) return false;
  if (target.isContentEditable || ["INPUT", "SELECT", "TEXTAREA"].includes(target.tagName)) {
    return true;
  }
  if (target.closest("[role=dialog]")) return true;
  if (target.closest("[role=slider]") && SLIDER_KEYS.has(e.key)) return true;
  const control = target.closest("button, a[href], summary, [role=button]");
  if ((e.key === " " || e.key === "Enter") && control && hasKeyboardFocus(control)) {
    return true;
  }
  return false;
}

/**
 * Keyboard users (focus-visible) get native Space/Enter activation. A mouse user who
 * just clicked a match row still has focus on it, and for them Space should play
 * rather than re-click the row.
 */
function hasKeyboardFocus(el: Element): boolean {
  try {
    return el.matches(":focus-visible");
  } catch {
    return true;
  }
}

/**
 * Global single-key shortcuts (keys are KeyboardEvent.key values). See
 * shouldIgnoreShortcut for when they stand aside. Playback keys live in the timeline.
 */
export function useShortcuts(map: ShortcutMap) {
  const ref = useRef(map);
  ref.current = map;
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (shouldIgnoreShortcut(e)) return;
      const action = ref.current[e.key] ?? ref.current[e.key.toLowerCase()];
      if (!action) return;
      e.preventDefault();
      action();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);
}
