"use client";

import { useEffect, useState } from "react";

export type ImageState =
  | { status: "loading"; image: null }
  | { status: "ready"; image: HTMLImageElement }
  | { status: "error"; image: null };

/** Load and decode an image element for Konva, reporting loading / ready / error. */
export function useHtmlImage(src: string | null): ImageState {
  const [result, setResult] = useState<{ src: string; state: ImageState } | null>(null);

  useEffect(() => {
    if (!src) return;
    let cancelled = false;
    const img = new window.Image();
    img.decoding = "async";
    img.src = src;
    img
      .decode()
      .then(() => !cancelled && setResult({ src, state: { status: "ready", image: img } }))
      .catch(() => !cancelled && setResult({ src, state: { status: "error", image: null } }));
    return () => {
      cancelled = true;
    };
  }, [src]);

  return result && result.src === src ? result.state : { status: "loading", image: null };
}
