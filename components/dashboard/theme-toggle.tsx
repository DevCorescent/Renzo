"use client";

// Global theme switch — a SINGLE button that cycles Light → Dark → System.
//
// One click advances to the next mode; the button shows the icon of the CURRENT
// choice (Sun / Moon / Monitor) and calls setTheme(), which persists the choice
// and flips <html> instantly — no refresh, no flash. "System" then tracks the OS
// live. It reads the raw CHOICE (not the resolved theme) so it always reflects
// what the user picked, and its own colours come from the neutral tokens, so the
// switch follows the active theme like everything else.
import { Sun, Moon, Monitor } from "lucide-react";
import { useThemeChoice, setTheme, type ThemeChoice } from "./use-dash-theme";

// The cycle order and, for each mode, the icon to show and what the NEXT click does.
const CYCLE: Record<
  ThemeChoice,
  { label: string; next: ThemeChoice; Icon: React.ComponentType<{ className?: string }> }
> = {
  light: { label: "Light", next: "dark", Icon: Sun },
  dark: { label: "Dark", next: "system", Icon: Moon },
  system: { label: "System", next: "light", Icon: Monitor },
};

export function ThemeToggle({ dark = false }: { dark?: boolean }) {
  const choice = useThemeChoice();
  const { label, next, Icon } = CYCLE[choice];

  const cls = dark
    ? "flex size-9 items-center justify-center rounded-lg text-stone-400 transition-colors hover:bg-white/8 hover:text-stone-100 focus-visible:outline-none"
    : "flex size-9 items-center justify-center rounded-lg border border-gray-200 bg-white text-gray-500 transition-colors hover:bg-gray-50 hover:text-gray-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gray-900/15 dark:border-(--sa-border) dark:bg-(--sa-surface) dark:text-(--sa-text-2) dark:hover:bg-(--sa-hover) dark:hover:text-(--sa-text)";

  return (
    <button
      type="button"
      onClick={() => setTheme(next)}
      aria-label={`Theme: ${label}. Switch to ${CYCLE[next].label}`}
      title={`Theme: ${label} — click for ${CYCLE[next].label}`}
      className={cls}
    >
      <Icon className="size-4.5" />
    </button>
  );
}
