"use client";

// Scoped light/dark theme store for the Super Admin dashboard ONLY.
// The `dark` class lives on the dashboard root element (id below), never on
// <html>, so no other page/role is affected. State is read straight from the
// DOM via useSyncExternalStore — hydration-safe (server snapshot = "light") and
// lint-safe (no setState-in-effect). A pre-paint inline script applies the
// stored class before first paint, so there is no flash on reload.
import { useSyncExternalStore } from "react";

export type DashTheme = "light" | "dark";

export const THEME_KEY = "sa-dash-theme";
export const THEME_ROOT_ID = "sa-dash-root";
const THEME_EVENT = "sa-dash-theme-change";

/**
 * Runs before hydration (no FOUC): use the saved choice if present, otherwise
 * fall back to the OS `prefers-color-scheme` on first visit.
 */
export const THEME_INIT_SCRIPT = `(function(){try{var e=document.getElementById('${THEME_ROOT_ID}');if(!e)return;var t=localStorage.getItem('${THEME_KEY}');var d=t?t==='dark':window.matchMedia('(prefers-color-scheme: dark)').matches;if(d){e.classList.add('dark');}}catch(_){}})();`;

function subscribe(cb: () => void) {
  if (typeof window === "undefined") return () => {};
  window.addEventListener(THEME_EVENT, cb);
  return () => window.removeEventListener(THEME_EVENT, cb);
}

function getSnapshot(): DashTheme {
  if (typeof document === "undefined") return "light";
  return document.getElementById(THEME_ROOT_ID)?.classList.contains("dark") ? "dark" : "light";
}

function getServerSnapshot(): DashTheme {
  return "light";
}

export function useDashTheme(): DashTheme {
  return useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
}

export function toggleDashTheme() {
  const el = document.getElementById(THEME_ROOT_ID);
  if (!el) return;
  const next: DashTheme = el.classList.contains("dark") ? "light" : "dark";
  el.classList.toggle("dark", next === "dark");
  try {
    localStorage.setItem(THEME_KEY, next);
  } catch {
    /* ignore */
  }
  window.dispatchEvent(new Event(THEME_EVENT));
}
