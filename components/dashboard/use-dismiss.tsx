"use client";

// Closes a popover on outside-click or Escape. Returns a ref to attach to the
// popover root (trigger + panel).
import * as React from "react";

export function useDismiss<T extends HTMLElement>(onDismiss: () => void) {
  const ref = React.useRef<T>(null);

  React.useEffect(() => {
    function onPointer(e: MouseEvent | TouchEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) onDismiss();
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onDismiss();
    }
    document.addEventListener("mousedown", onPointer);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onPointer);
      document.removeEventListener("keydown", onKey);
    };
  }, [onDismiss]);

  return ref;
}
