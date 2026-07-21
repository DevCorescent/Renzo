"use client";

// DEPRECATED — retained only so existing dashboard roots that still render
// <DashThemeInit /> keep compiling without churn.
//
// Theme is now GLOBAL: the `dark` class lives on <html>, applied before first
// paint by THEME_INIT_SCRIPT (see use-dash-theme.ts) and kept in sync by the
// global store. A page no longer initialises its own scoped theme, so this
// component is intentionally a no-op. New code should not render it.
export function DashThemeInit() {
  return null;
}
