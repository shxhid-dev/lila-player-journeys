"use client";

import { useEffect, useState } from "react";

/** Load an image element for Konva. Returns null until it has decoded. */
export function useHtmlImage(src: string | null): HTMLImageElement | null {
  const [loaded, setLoaded] = useState<{ src: string; img: HTMLImageElement } | null>(null);

  useEffect(() => {
    if (!src) return;
    let cancelled = false;
    const img = new window.Image();
    img.decoding = "async";
    img.src = src;
    img
      .decode()
      .then(() => !cancelled && setLoaded({ src, img }))
      .catch(() => !cancelled && setLoaded(null));
    return () => {
      cancelled = true;
    };
  }, [src]);

  return loaded && loaded.src === src ? loaded.img : null;
}
