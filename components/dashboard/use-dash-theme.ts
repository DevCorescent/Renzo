"use client";

// ============================================================================
// GLOBAL THEME STORE — the single source of truth for the whole application.
//
// The `dark` class lives on <html> (document.documentElement), never on a
// per-page element, so EVERY page, layout, dialog, sidebar and nested route
// inherits the active theme automatically — there is one class, one localStorage
// key, one store. Three choices are supported: "light", "dark" and "system";
// "system" follows the OS `prefers-color-scheme` live, with no refresh.
//
// State is read straight from the DOM/localStorage via useSyncExternalStore —
// hydration-safe (server snapshot is deterministic) and lint-safe (no
// setState-in-effect). A pre-paint inline script (THEME_INIT_SCRIPT, injected in
// the root layout) applies the class before first paint, so there is never a
// white/black flash on load or navigation.
//
// The historical `useDashTheme`/`toggleDashTheme`/`THEME_ROOT_ID` names are kept
// so existing callers (charts, dashboard roots) keep working unchanged; they now
// simply read the global theme instead of a scoped one.
// ============================================================================

import { useSyncExternalStore } from "react";

/** Resolved, concrete theme actually painted. */
export type DashTheme = "light" | "dark";
/** User choice — "system" defers to the operating system. */
export type ThemeChoice = "light" | "dark" | "system";

// Key kept stable so a previously-saved preference survives this upgrade.
export const THEME_KEY = "sa-dash-theme";
// Retained purely as a DOM id/layout marker on dashboard roots — it no longer
// carries the theme class (that is on <html> now).
export const THEME_ROOT_ID = "sa-dash-root";
const THEME_EVENT = "sa-theme-change";

/**
 * Runs in <head> BEFORE hydration and first paint (no FOUC): apply the saved
 * choice, or the OS preference when unset/"system", to <html>. Must use the same
 * key and class as this module.
 */
export const THEME_INIT_SCRIPT = `(function(){try{var k='${THEME_KEY}';var c=localStorage.getItem(k);if(c!=='light'&&c!=='dark'&&c!=='system'){c='system';}var d=c==='dark'||(c==='system'&&window.matchMedia('(prefers-color-scheme: dark)').matches);var e=document.documentElement;e.classList.toggle('dark',d);e.style.colorScheme=d?'dark':'light';}catch(_){}})();`;

function systemPrefersDark(): boolean {
  return typeof window !== "undefined" && window.matchMedia("(prefers-color-scheme: dark)").matches;
}

function readChoice(): ThemeChoice {
  try {
    const c = localStorage.getItem(THEME_KEY);
    if (c === "light" || c === "dark" || c === "system") return c;
  } catch {
    /* ignore */
  }
  return "system";
}

function resolve(choice: ThemeChoice): DashTheme {
  return choice === "system" ? (systemPrefersDark() ? "dark" : "light") : choice;
}

/** Apply the resolved theme to <html> — the one place the class is written. */
function apply(choice: ThemeChoice) {
  if (typeof document === "undefined") return;
  const dark = resolve(choice) === "dark";
  const el = document.documentElement;
  el.classList.toggle("dark", dark);
  el.style.colorScheme = dark ? "dark" : "light";
}

function subscribe(cb: () => void) {
  if (typeof window === "undefined") return () => {};
  window.addEventListener(THEME_EVENT, cb);

  // Follow the OS live while in "system" mode — flips instantly, no refresh.
  const mq = window.matchMedia("(prefers-color-scheme: dark)");
  const onMedia = () => {
    if (readChoice() === "system") {
      apply("system");
      cb();
    }
  };
  mq.addEventListener("change", onMedia);

  // Keep other tabs in sync when the choice changes.
  const onStorage = (e: StorageEvent) => {
    if (e.key === THEME_KEY) {
      apply(readChoice());
      cb();
    }
  };
  window.addEventListener("storage", onStorage);

  return () => {
    window.removeEventListener(THEME_EVENT, cb);
    mq.removeEventListener("change", onMedia);
    window.removeEventListener("storage", onStorage);
  };
}

/* ─── Resolved theme (light|dark) — used by charts and any colour-branching UI ── */
function getResolvedSnapshot(): DashTheme {
  if (typeof document === "undefined") return "light";
  return document.documentElement.classList.contains("dark") ? "dark" : "light";
}
function getResolvedServerSnapshot(): DashTheme {
  return "light";
}
export function useDashTheme(): DashTheme {
  return useSyncExternalStore(subscribe, getResolvedSnapshot, getResolvedServerSnapshot);
}

/* ─── Raw choice (light|dark|system) — used by the theme switch UI ───────────── */
function getChoiceSnapshot(): ThemeChoice {
  return readChoice();
}
function getChoiceServerSnapshot(): ThemeChoice {
  return "system";
}
export function useThemeChoice(): ThemeChoice {
  return useSyncExternalStore(subscribe, getChoiceSnapshot, getChoiceServerSnapshot);
}

/** Persist and apply a theme choice, then notify every subscriber instantly. */
export function setTheme(choice: ThemeChoice) {
  try {
    localStorage.setItem(THEME_KEY, choice);
  } catch {
    /* ignore */
  }
  apply(choice);
  if (typeof window !== "undefined") window.dispatchEvent(new Event(THEME_EVENT));
}

/** Back-compat binary flip (light ↔ dark), based on what is currently painted. */
export function toggleDashTheme() {
  setTheme(getResolvedSnapshot() === "dark" ? "light" : "dark");
}
