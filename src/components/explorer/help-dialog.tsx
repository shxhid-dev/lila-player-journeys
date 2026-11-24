"use client";

import * as Dialog from "@radix-ui/react-dialog";
import { X } from "lucide-react";

export const SHORTCUTS: [string, string][] = [
  ["Space", "Play / pause"],
  ["← / →", "Step 5 s (hold Shift for 30 s)"],
  ["Home / End", "Jump to start / end of match"],
  ["[ / ]", "Slower / faster playback"],
  ["H", "Cycle heatmap layer"],
  ["G", "Toggle calibration grid"],
  ["+ / −", "Zoom in / out"],
  ["0", "Reset view"],
  ["E", "Export current view as PNG"],
  ["L", "Copy link to this exact view"],
  ["?", "Show this help"],
];

export function HelpDialog({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-40 bg-black/60 backdrop-blur-sm" />
        <Dialog.Content className="fixed top-1/2 left-1/2 z-50 max-h-[85vh] w-[min(560px,92vw)] -translate-x-1/2 -translate-y-1/2 overflow-y-auto rounded-xl border border-border bg-panel p-6 shadow-2xl focus:outline-none">
          <div className="mb-4 flex items-start justify-between gap-4">
            <div>
              <Dialog.Title className="text-base font-semibold">How to use this tool</Dialog.Title>
              <Dialog.Description className="mt-1 text-sm text-muted">
                Five days of LILA BLACK telemetry (10–14 Feb 2026), drawn on each map.
              </Dialog.Description>
            </div>
            <Dialog.Close className="rounded p-1 text-muted hover:bg-panel-raised hover:text-foreground">
              <X className="h-4 w-4" />
              <span className="sr-only">Close</span>
            </Dialog.Close>
          </div>

          <ol className="mb-5 list-decimal space-y-1.5 pl-5 text-sm leading-relaxed">
            <li>Pick a map at the top, then narrow by date, player type and event type.</li>
            <li>
              Click a match in the list to replay it. Ctrl/⌘-click adds up to three for comparison.
            </li>
            <li>Press Space to watch the match unfold. Hover a path or marker for details.</li>
            <li>
              Turn on a heatmap to see traffic, kill, death, storm or loot density across every
              filtered match, or just the selected ones.
            </li>
            <li>The URL always holds the current view, so copy it (L) to share exactly this.</li>
          </ol>

          <h3 className="mb-2 text-[11px] font-medium tracking-wider text-muted uppercase">
            Keyboard shortcuts
          </h3>
          <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-1.5 text-sm">
            {SHORTCUTS.map(([key, label]) => (
              <div key={key} className="contents">
                <dt>
                  <kbd className="rounded border border-border bg-panel-raised px-1.5 py-0.5 font-mono text-xs">
                    {key}
                  </kbd>
                </dt>
                <dd className="text-muted">{label}</dd>
              </div>
            ))}
          </dl>

          <h3 className="mt-5 mb-2 text-[11px] font-medium tracking-wider text-muted uppercase">
            Reading the data
          </h3>
          <ul className="list-disc space-y-1 pl-5 text-sm leading-relaxed text-muted">
            <li>
              Most matches carry telemetry for one human. Bot paths exist for 52 of 796 matches.
            </li>
            <li>
              “Survived” means no death was logged. The data has no extraction event, so it can’t
              tell an extraction from a disconnect.
            </li>
            <li>The storm front isn’t in the telemetry. Only storm deaths are shown.</li>
            <li>Turn on the calibration grid (G) to check any point’s world coordinates.</li>
          </ul>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
