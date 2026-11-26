// @vitest-environment happy-dom
import { describe, expect, it } from "vitest";
import { shouldIgnoreShortcut } from "./use-shortcuts";

/** A keydown event as the window listener would see it, targeted at `target`. */
function press(key: string, target: HTMLElement, init: KeyboardEventInit = {}) {
  const e = new KeyboardEvent("keydown", { key, bubbles: true, cancelable: true, ...init });
  Object.defineProperty(e, "target", { value: target });
  return e;
}

const el = (tag: string, attrs: Record<string, string> = {}, parent?: HTMLElement) => {
  const node = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs)) node.setAttribute(k, v);
  parent?.appendChild(node);
  return node;
};

describe("shouldIgnoreShortcut", () => {
  it("lets shortcuts through from the page body", () => {
    expect(shouldIgnoreShortcut(press("h", document.body))).toBe(false);
    expect(shouldIgnoreShortcut(press(" ", document.body))).toBe(false);
  });

  it("ignores typing in fields and modifier chords", () => {
    expect(shouldIgnoreShortcut(press("n", el("input")))).toBe(true);
    expect(shouldIgnoreShortcut(press("l", document.body, { ctrlKey: true }))).toBe(true);
  });

  it("stands aside inside a dialog", () => {
    const close = el("button", {}, el("div", { role: "dialog" }));
    expect(shouldIgnoreShortcut(press("h", close))).toBe(true);
    expect(shouldIgnoreShortcut(press(" ", close))).toBe(true);
  });

  it("leaves navigation keys to a focused slider, but not letters", () => {
    const thumb = el("span", { role: "slider" });
    expect(shouldIgnoreShortcut(press("ArrowLeft", thumb))).toBe(true);
    expect(shouldIgnoreShortcut(press("Home", thumb))).toBe(true);
    expect(shouldIgnoreShortcut(press("h", thumb))).toBe(false);
  });

  /** A button whose focus did or didn't come from the keyboard (:focus-visible). */
  const button = (keyboard: boolean) => {
    const b = el("button");
    const native = b.matches.bind(b);
    b.matches = (sel: string) => (sel === ":focus-visible" ? keyboard : native(sel));
    return b;
  };

  it("lets Space and Enter activate a keyboard-focused button", () => {
    const b = button(true);
    expect(shouldIgnoreShortcut(press(" ", b))).toBe(true);
    expect(shouldIgnoreShortcut(press("Enter", b))).toBe(true);
    expect(shouldIgnoreShortcut(press("n", b))).toBe(false);
  });

  it("keeps Space as play/pause after a mouse click left focus on a button", () => {
    expect(shouldIgnoreShortcut(press(" ", button(false)))).toBe(false);
  });

  it("respects a handler that already took the key", () => {
    const e = press("h", document.body);
    e.preventDefault();
    expect(shouldIgnoreShortcut(e)).toBe(true);
  });
});
