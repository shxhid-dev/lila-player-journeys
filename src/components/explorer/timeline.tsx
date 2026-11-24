"use client";

import * as Slider from "@radix-ui/react-slider";
import { Pause, Play, RotateCcw, SkipBack, SkipForward } from "lucide-react";
import { useEffect, useMemo } from "react";
import { Button } from "@/components/ui/button";
import { SPEEDS, usePlaybackLoop } from "@/hooks/use-playback";
import { EVENT_STYLES } from "@/lib/colors";
import { formatClock } from "@/lib/journey";
import { describeEvent } from "@/lib/labels";
import type { Scene } from "@/lib/scene";
import { cn } from "@/lib/utils";
import { useExplorer } from "@/store/explorer";

const STEP = 5; // seconds: one position sample
const BIG_STEP = 30;

function isTyping(target: EventTarget | null) {
  return (
    target instanceof HTMLElement &&
    (target.isContentEditable || ["INPUT", "SELECT", "TEXTAREA"].includes(target.tagName))
  );
}

export function Timeline({ scene }: { scene: Scene }) {
  const { duration } = scene;
  const time = useExplorer((s) => s.time);
  const playing = useExplorer((s) => s.playing);
  const speed = useExplorer((s) => s.speed);
  const { setTime, setPlaying, setSpeed } = useExplorer.getState();
  usePlaybackLoop(duration);

  const disabled = duration === 0;
  const atEnd = time >= duration;

  const togglePlay = () => {
    if (disabled) return;
    if (!playing && atEnd) setTime(0);
    setPlaying(!playing);
  };

  // Playback keys. Space and arrows skip text inputs so typing a match ID still works.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (disabled || isTyping(e.target) || e.metaKey || e.ctrlKey || e.altKey) return;
      const { time: t, speed: s } = useExplorer.getState();
      const step = e.shiftKey ? BIG_STEP : STEP;
      const i = SPEEDS.indexOf(s as (typeof SPEEDS)[number]);
      switch (e.key) {
        case " ":
          e.preventDefault();
          togglePlay();
          break;
        case "ArrowLeft":
          e.preventDefault();
          setTime(Math.max(0, t - step));
          break;
        case "ArrowRight":
          e.preventDefault();
          setTime(Math.min(duration, t + step));
          break;
        case "Home":
          setTime(0);
          break;
        case "End":
          setTime(duration);
          break;
        case "[":
          setSpeed(SPEEDS[Math.max(0, i - 1)]);
          break;
        case "]":
          setSpeed(SPEEDS[Math.min(SPEEDS.length - 1, i + 1)]);
          break;
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  });

  // Combat and storm ticks on the track; loot is too dense to be useful here.
  const ticks = useMemo(
    () =>
      scene.events
        .filter((e) => e.type !== "loot")
        .map((e) => ({ ...e, left: duration ? (e.t / duration) * 100 : 0 })),
    [scene.events, duration],
  );

  const alive = useMemo(() => {
    let humans = 0;
    let bots = 0;
    for (const sj of scene.journeys) {
      if (
        time >= sj.journey.start &&
        time <= sj.journey.end &&
        !(atEnd && sj.journey.outcome !== "survived")
      ) {
        if (sj.journey.kind === "human") humans++;
        else bots++;
      }
    }
    return { humans, bots };
  }, [scene.journeys, time, atEnd]);

  return (
    <div
      className={cn(
        "flex h-16 shrink-0 items-center gap-3 border-t border-border bg-panel px-4",
        disabled && "opacity-50",
      )}
      aria-label="Match playback"
    >
      <div className="flex items-center gap-1">
        <Button
          size="icon"
          variant="ghost"
          aria-label="Back to start (Home)"
          title="Back to start (Home)"
          disabled={disabled}
          onClick={() => setTime(0)}
        >
          <SkipBack className="h-4 w-4" />
        </Button>
        <Button
          size="icon"
          aria-label={playing ? "Pause (Space)" : "Play (Space)"}
          title={playing ? "Pause (Space)" : "Play (Space)"}
          disabled={disabled}
          onClick={togglePlay}
          className="h-9 w-9"
        >
          {playing ? (
            <Pause className="h-4 w-4" />
          ) : atEnd ? (
            <RotateCcw className="h-4 w-4" />
          ) : (
            <Play className="h-4 w-4" />
          )}
        </Button>
        <Button
          size="icon"
          variant="ghost"
          aria-label="Jump to end (End)"
          title="Jump to end (End)"
          disabled={disabled}
          onClick={() => setTime(duration)}
        >
          <SkipForward className="h-4 w-4" />
        </Button>
      </div>

      <div className="shrink-0 font-mono text-xs tabular-nums lg:w-24">
        <span className="text-foreground">{formatClock(Math.min(time, duration))}</span>
        <span className="text-muted"> / {formatClock(duration)}</span>
      </div>

      <div className="relative min-w-[120px] flex-1">
        <div className="pointer-events-none absolute inset-x-0 -top-2.5 h-2" aria-hidden>
          {ticks.map((e) => (
            <span
              key={e.key}
              className="absolute top-0 h-2 w-0.5 -translate-x-1/2 rounded-full"
              style={{ left: `${e.left}%`, background: EVENT_STYLES[e.type].color }}
              title={`${formatClock(e.t)} ${describeEvent(e.type, e.detail)}`}
            />
          ))}
        </div>
        <Slider.Root
          className="relative flex h-5 touch-none items-center select-none"
          min={0}
          max={Math.max(1, duration)}
          step={1}
          value={[Math.min(time, duration)]}
          disabled={disabled}
          onValueChange={([v]) => {
            setPlaying(false);
            setTime(v);
          }}
          aria-label="Match time"
        >
          <Slider.Track className="relative h-1.5 grow rounded-full bg-panel-raised">
            <Slider.Range className="absolute h-full rounded-full bg-accent/70" />
          </Slider.Track>
          <Slider.Thumb
            className="block h-4 w-4 rounded-full border-2 border-accent bg-background focus-visible:ring-2 focus-visible:ring-accent/60 focus-visible:outline-none"
            aria-valuetext={formatClock(time)}
          />
        </Slider.Root>
      </div>

      <div
        className="hidden shrink-0 text-xs text-muted tabular-nums xl:block"
        title="Journeys with telemetry alive at this moment"
      >
        Alive {alive.humans}H · {alive.bots}B
      </div>

      {/* Narrow layouts: one button that cycles speeds, so the scrubber keeps its room. */}
      <Button
        size="sm"
        variant="outline"
        className="w-12 justify-center tabular-nums xl:hidden"
        disabled={disabled}
        onClick={() =>
          setSpeed(SPEEDS[(SPEEDS.indexOf(speed as (typeof SPEEDS)[number]) + 1) % SPEEDS.length])
        }
        aria-label={`Playback speed ${speed}×, click to change`}
        title="Speed ([ / ])"
      >
        {speed}×
      </Button>
      <div
        className="hidden shrink-0 rounded-md border border-border p-0.5 xl:flex"
        role="group"
        aria-label="Playback speed"
      >
        {SPEEDS.map((s) => (
          <button
            key={s}
            type="button"
            disabled={disabled}
            onClick={() => setSpeed(s)}
            aria-pressed={speed === s}
            title="Speed ([ / ])"
            className={cn(
              "rounded px-1.5 py-0.5 text-[11px] tabular-nums",
              speed === s ? "bg-panel-raised text-foreground" : "text-muted hover:text-foreground",
            )}
          >
            {s}×
          </button>
        ))}
      </div>
    </div>
  );
}
