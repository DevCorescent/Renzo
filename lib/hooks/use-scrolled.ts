"use client";

import { useEffect, useState } from "react";

/**
 * Returns `true` once the window has scrolled past `threshold` pixels.
 * Used for scroll-adaptive UI (e.g. elevating the site header). Purely a
 * class toggle, so it is safe under `prefers-reduced-motion`.
 */
export function useScrolled(threshold = 8): boolean {
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > threshold);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, [threshold]);

  return scrolled;
}
