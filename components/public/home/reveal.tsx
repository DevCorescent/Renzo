"use client";

// OWNER: Gauransh | COMPONENT: Scroll-reveal wrapper (fade + rise on enter)
import { useEffect, useRef, useState, type ReactNode } from "react";
import { cn } from "@/lib/utils";

interface RevealProps {
  children: ReactNode;
  className?: string;
  /** Stagger delay in milliseconds. */
  delay?: number;
}

/**
 * Reveals its children with a subtle fade + rise when scrolled into view.
 * Fully accessible: under `prefers-reduced-motion` the content is shown
 * immediately with no transform.
 */
export function Reveal({ children, className, delay = 0 }: RevealProps) {
  const ref = useRef<HTMLDivElement>(null);
  const [shown, setShown] = useState(false);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;

    // Note: under `prefers-reduced-motion` the `motion-safe:` classes below
    // never apply, so the content is visible on first paint regardless of state.
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setShown(true);
          observer.disconnect();
        }
      },
      { threshold: 0.15, rootMargin: "0px 0px -10% 0px" },
    );

    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  return (
    <div
      ref={ref}
      style={delay ? { transitionDelay: `${delay}ms` } : undefined}
      className={cn(
        "motion-safe:transition-all motion-safe:duration-700 motion-safe:ease-out",
        shown
          ? "translate-y-0 opacity-100"
          : "motion-safe:translate-y-6 motion-safe:opacity-0",
        className,
      )}
    >
      {children}
    </div>
  );
}
