"use client";

// Sun/Moon theme switch for the dashboard top bar. Animated icon swap.
import { motion, AnimatePresence } from "framer-motion";
import { Sun, Moon } from "lucide-react";
import { useDashTheme, toggleDashTheme } from "./use-dash-theme";

export function ThemeToggle() {
  const theme = useDashTheme();
  const dark = theme === "dark";
  const label = dark ? "Light mode" : "Dark mode";

  return (
    <div className="group relative flex">
      <button
        type="button"
        onClick={toggleDashTheme}
        role="switch"
        aria-checked={dark}
        aria-label={`Switch to ${dark ? "light" : "dark"} theme`}
        className="relative flex size-9 items-center justify-center overflow-hidden rounded-lg text-gray-500 transition-colors hover:bg-gray-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-200 active:scale-95 dark:text-(--sa-text-2) dark:hover:bg-(--sa-hover) dark:hover:text-(--sa-text) dark:focus-visible:ring-white/20"
      >
        <AnimatePresence mode="wait" initial={false}>
          {dark ? (
            <motion.span
              key="moon"
              initial={{ opacity: 0, rotate: -90, scale: 0.5 }}
              animate={{ opacity: 1, rotate: 0, scale: 1 }}
              exit={{ opacity: 0, rotate: 90, scale: 0.5 }}
              transition={{ duration: 0.2, ease: "easeOut" }}
              className="flex"
            >
              <Moon className="size-4.5" />
            </motion.span>
          ) : (
            <motion.span
              key="sun"
              initial={{ opacity: 0, rotate: 90, scale: 0.5 }}
              animate={{ opacity: 1, rotate: 0, scale: 1 }}
              exit={{ opacity: 0, rotate: -90, scale: 0.5 }}
              transition={{ duration: 0.2, ease: "easeOut" }}
              className="flex"
            >
              <Sun className="size-4.5" />
            </motion.span>
          )}
        </AnimatePresence>
      </button>

      {/* Tooltip — appears on hover/keyboard focus */}
      <span
        role="tooltip"
        className="pointer-events-none absolute left-1/2 top-full z-50 mt-2 -translate-x-1/2 translate-y-1 whitespace-nowrap rounded-md bg-gray-900 px-2 py-1 text-[11px] font-medium text-white opacity-0 shadow-lg transition-all duration-150 group-hover:translate-y-0 group-hover:opacity-100 group-focus-within:translate-y-0 group-focus-within:opacity-100 dark:bg-(--sa-elevated) dark:text-(--sa-text) dark:ring-1 dark:ring-(--sa-border)"
      >
        {label}
      </span>
    </div>
  );
}
