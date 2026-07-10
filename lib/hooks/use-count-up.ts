"use client";

import { useEffect, useState } from "react";

interface CountUpOptions {
  /** Animation length in milliseconds. */
  duration?: number;
  /** Only start counting once this is `true` (e.g. when scrolled into view). */
  start?: boolean;
}

/**
 * Animates a number from 0 up to `target` with an ease-out curve once
 * `start` is true. Under `prefers-reduced-motion` it jumps straight to the
 * final value. Uses requestAnimationFrame (no synchronous effect setState).
 */
export function useCountUp(target: number, { duration = 1600, start = true }: CountUpOptions = {}): number {
  const [value, setValue] = useState(0);

  useEffect(() => {
    if (!start) return;

    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    let frame = 0;
    let startTime: number | null = null;

    const tick = (now: number) => {
      if (startTime === null) startTime = now;
      const progress = reduce ? 1 : Math.min((now - startTime) / duration, 1);
      const eased = 1 - Math.pow(1 - progress, 3); // easeOutCubic
      setValue(Math.round(target * eased));
      if (progress < 1) frame = requestAnimationFrame(tick);
    };

    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [target, duration, start]);

  return value;
}
