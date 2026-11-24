"use client";

import { useEffect } from "react";
import { useExplorer } from "@/store/explorer";

/** Advances the playback clock with requestAnimationFrame while playing. */
export function usePlaybackLoop(duration: number) {
  const playing = useExplorer((s) => s.playing);

  useEffect(() => {
    if (!playing) return;
    let raf = 0;
    let last = performance.now();
    const tick = (now: number) => {
      const { time, speed, setTime, setPlaying } = useExplorer.getState();
      // Clamp the frame delta so a backgrounded tab doesn't jump to the end on return,
      // while still keeping real time on slow or throttled frames.
      const dt = Math.min(now - last, 500) / 1000;
      last = now;
      const next = time + dt * speed;
      if (next >= duration) {
        setTime(duration);
        setPlaying(false);
        return;
      }
      setTime(next);
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [playing, duration]);
}

export const SPEEDS = [0.5, 1, 2, 4, 8, 16] as const;
