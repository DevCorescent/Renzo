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

export function ThemeToggle() {
  const choice = useThemeChoice();
  const { label, next, Icon } = CYCLE[choice];

  return (
    <button
      type="button"
      onClick={() => setTheme(next)}
      // Announce the current mode and the next one, so keyboard/screen-reader users
      // know both where they are and what a click will do.
      aria-label={`Theme: ${label}. Switch to ${CYCLE[next].label}`}
      title={`Theme: ${label} — click for ${CYCLE[next].label}`}
      className="flex size-9 items-center justify-center rounded-lg border border-gray-200 bg-white text-gray-500 transition-colors hover:bg-gray-50 hover:text-gray-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gray-900/15"
    >
      <Icon className="size-4.5" />
    </button>
  );
}
