"use client";

// Applies the saved (or OS-preferred) dashboard theme to the #sa-dash-root
// element. Replaces the old inline <script>: React 19 does not execute a <script>
// rendered inside a component on the client (only in the initial server HTML), so
// that script both logged a dev warning and silently failed on client-side
// navigation between dashboards. useInsertionEffect runs during commit — before
// layout effects and before paint — so the theme is applied without a flash on
// navigation, and the DOM node the toggle reads is set before anything reads it.
import { useInsertionEffect } from "react";
import { THEME_KEY, THEME_ROOT_ID } from "./use-dash-theme";

export function DashThemeInit() {
  useInsertionEffect(() => {
    try {
      const el = document.getElementById(THEME_ROOT_ID);
      if (!el) return;
      const stored = localStorage.getItem(THEME_KEY);
      const dark = stored
        ? stored === "dark"
        : window.matchMedia("(prefers-color-scheme: dark)").matches;
      el.classList.toggle("dark", dark);
    } catch {
      /* ignore */
    }
  }, []);
  return null;
}
