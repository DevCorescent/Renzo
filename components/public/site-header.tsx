"use client";

// OWNER: Gauransh | COMPONENT: Public site header (nav bar) — floating glassmorphism, 2026, silver accent
import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { AnimatePresence, motion } from "framer-motion";
import { Scissors, Menu, X, LayoutDashboard, LogIn, UserPlus } from "lucide-react";
import { useScrolled } from "@/lib/hooks/use-scrolled";
import { cn } from "@/lib/utils";

export const PUBLIC_NAV_LINKS = [
  { label: "Home", href: "/" },
  { label: "Services", href: "/services" },
  { label: "Branches", href: "/branches" },
  { label: "Gallery", href: "/gallery" },
  { label: "Pricing", href: "/packages" },
];

function isActiveLink(pathname: string, href: string): boolean {
  return href === "/" ? pathname === "/" : pathname.startsWith(href);
}

interface SiteHeaderProps {
  /** Passed from a Server Component — non-null means user is already logged in */
  dashboardHref?: string | null;
}

const FOCUS_RING =
  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/50 focus-visible:ring-offset-2 focus-visible:ring-offset-transparent rounded-full";

export function SiteHeader({ dashboardHref }: SiteHeaderProps = {}) {
  const [open, setOpen] = useState(false);
  const pathname = usePathname();
  const scrolled = useScrolled(12);

  return (
    <header className="sticky top-0 z-50 w-full px-3 pt-3 sm:px-4 sm:pt-4">
      {/* Floating glass pill — no black fill, just blur + a hairline border */}
      <div
        className={cn(
          "mx-auto flex h-16 w-full max-w-[1400px] items-center justify-between rounded-full border px-4 transition-all duration-500 sm:px-6",
          scrolled || open
            ? "border-white/15 bg-white/[0.06] shadow-[0_20px_60px_rgba(0,0,0,0.35)] backdrop-blur-2xl supports-[backdrop-filter]:bg-white/[0.05]"
            : "border-white/10 bg-transparent backdrop-blur-xl"
        )}
      >
        {/* Logo */}
        <Link
          href="/"
          className={cn("group flex items-center gap-2", FOCUS_RING)}
          onClick={() => setOpen(false)}
        >
          <span className="inline-flex size-8 items-center justify-center rounded-full bg-[#C9CDD3]/15 text-[#C9CDD3] ring-1 ring-[#C9CDD3]/30 transition-all duration-300 group-hover:scale-105 group-hover:bg-[#C9CDD3]/25">
            <Scissors className="size-4" />
          </span>
          <span className="font-heading text-2xl font-bold tracking-tight text-white transition-transform duration-300 group-hover:scale-[1.02]">
            Renzo
          </span>
        </Link>

        {/* Desktop nav */}
        <nav className="hidden items-center gap-8 lg:flex" aria-label="Primary">
          {PUBLIC_NAV_LINKS.map((link) => {
            const active = isActiveLink(pathname, link.href);
            return (
              <Link
                key={link.href}
                href={link.href}
                aria-current={active ? "page" : undefined}
                className={cn(
                  "group relative py-1 text-sm font-medium transition-colors duration-300",
                  FOCUS_RING,
                  active ? "text-white" : "text-stone-300 hover:text-white"
                )}
              >
                <span className="transition-[text-shadow] duration-300 group-hover:[text-shadow:0_0_18px_rgba(201,205,211,0.5)]">
                  {link.label}
                </span>
                <span
                  className={cn(
                    "absolute -bottom-1 left-0 h-px bg-[#C9CDD3] transition-all duration-300",
                    active ? "w-full" : "w-0 group-hover:w-full"
                  )}
                />
              </Link>
            );
          })}
        </nav>

        {/* Desktop auth actions */}
        <div className="hidden items-center gap-2 lg:flex">
          {dashboardHref ? (
            <>
              <Link
                href={dashboardHref}
                className={cn(
                  "flex items-center gap-1.5 rounded-full border border-[#C9CDD3]/25 bg-[#C9CDD3]/10 px-4 py-2 text-sm font-medium text-[#C9CDD3] backdrop-blur-sm transition-all duration-300 hover:bg-[#C9CDD3]/20",
                  FOCUS_RING
                )}
              >
                <LayoutDashboard className="size-3.5" />
                Dashboard
              </Link>
              <Link
                href="/book"
                className={cn(
                  "group relative flex items-center gap-1.5 overflow-hidden rounded-full bg-gradient-to-r from-[#EDEFF2] via-[#C9CDD3] to-[#A9AEB8] px-4 py-2 text-sm font-semibold text-black shadow-[0_8px_25px_-8px_rgba(201,205,211,0.5)] transition-all duration-300 hover:-translate-y-0.5 hover:scale-[1.03] hover:shadow-[0_14px_35px_-8px_rgba(201,205,211,0.7)]",
                  FOCUS_RING
                )}
              >
                <span className="relative z-10">Book Now</span>
                <span
                  aria-hidden
                  className="absolute inset-0 -translate-x-full bg-linear-to-r from-transparent via-white/50 to-transparent transition-transform duration-700 group-hover:translate-x-full"
                />
              </Link>
            </>
          ) : (
            <>
              <Link
                href="/login"
                className={cn(
                  "flex items-center gap-1.5 rounded-full px-4 py-2 text-sm font-medium text-stone-300 transition-colors duration-300 hover:text-white",
                  FOCUS_RING
                )}
              >
                <LogIn className="size-3.5" />
                Sign in
              </Link>
              <Link
                href="/signup"
                className={cn(
                  "flex items-center gap-1.5 rounded-full border border-white/15 bg-white/5 px-4 py-2 text-sm font-medium text-stone-200 backdrop-blur-sm transition-all duration-300 hover:bg-white/10",
                  FOCUS_RING
                )}
              >
                <UserPlus className="size-3.5" />
                Sign up
              </Link>
              <Link
                href="/book"
                className={cn(
                  "group relative flex items-center gap-1.5 overflow-hidden rounded-full bg-gradient-to-r from-[#EDEFF2] via-[#C9CDD3] to-[#A9AEB8] px-4 py-2 text-sm font-semibold text-black shadow-[0_8px_25px_-8px_rgba(201,205,211,0.5)] transition-all duration-300 hover:-translate-y-0.5 hover:scale-[1.03] hover:shadow-[0_14px_35px_-8px_rgba(201,205,211,0.7)]",
                  FOCUS_RING
                )}
              >
                <span className="relative z-10">Book Now</span>
                <span
                  aria-hidden
                  className="absolute inset-0 -translate-x-full bg-linear-to-r from-transparent via-white/50 to-transparent transition-transform duration-700 group-hover:translate-x-full"
                />
              </Link>
            </>
          )}
        </div>

        {/* Mobile toggle */}
        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          aria-label={open ? "Close menu" : "Open menu"}
          aria-expanded={open}
          aria-controls="mobile-menu"
          className={cn(
            "inline-flex size-10 items-center justify-center text-white transition-transform duration-200 active:scale-90 lg:hidden",
            FOCUS_RING
          )}
        >
          {open ? <X className="size-6" /> : <Menu className="size-6" />}
        </button>
      </div>

      {/* Mobile menu — glass drawer, no black fill */}
      <AnimatePresence>
        {open && (
          <motion.div
            id="mobile-menu"
            initial={{ opacity: 0, y: -12, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -12, scale: 0.98 }}
            transition={{ type: "spring", stiffness: 300, damping: 28 }}
            className="mx-auto mt-2 w-full max-w-[1400px] overflow-hidden rounded-[28px] border border-white/15 bg-white/[0.06] shadow-[0_20px_60px_rgba(0,0,0,0.4)] backdrop-blur-2xl lg:hidden"
          >
            <nav className="flex flex-col px-5 py-4" aria-label="Mobile">
              {PUBLIC_NAV_LINKS.map((link, i) => {
                const active = isActiveLink(pathname, link.href);
                return (
                  <motion.div
                    key={link.href}
                    initial={{ opacity: 0, x: -12 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: 0.05 * i, duration: 0.3 }}
                  >
                    <Link
                      href={link.href}
                      onClick={() => setOpen(false)}
                      aria-current={active ? "page" : undefined}
                      className={cn(
                        "block border-b border-white/10 py-3 text-sm font-medium transition-colors duration-300",
                        FOCUS_RING,
                        active ? "text-white" : "text-stone-300 hover:text-white"
                      )}
                    >
                      {link.label}
                    </Link>
                  </motion.div>
                );
              })}

              <motion.div
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.05 * PUBLIC_NAV_LINKS.length, duration: 0.3 }}
                className="mt-4 flex flex-col gap-2"
              >
                {dashboardHref ? (
                  <Link
                    href={dashboardHref}
                    onClick={() => setOpen(false)}
                    className={cn(
                      "flex items-center justify-center gap-2 rounded-full border border-[#C9CDD3]/25 bg-[#C9CDD3]/10 py-2.5 text-sm font-medium text-[#C9CDD3] backdrop-blur-sm",
                      FOCUS_RING
                    )}
                  >
                    <LayoutDashboard className="size-4" />
                    Go to Dashboard
                  </Link>
                ) : (
                  <>
                    <Link
                      href="/signup"
                      onClick={() => setOpen(false)}
                      className={cn(
                        "flex items-center justify-center gap-2 rounded-full bg-white py-2.5 text-sm font-semibold text-stone-900 transition-transform duration-200 active:scale-[0.98]",
                        FOCUS_RING
                      )}
                    >
                      <UserPlus className="size-4" />
                      Create account
                    </Link>
                    <Link
                      href="/login"
                      onClick={() => setOpen(false)}
                      className={cn(
                        "flex items-center justify-center gap-2 rounded-full border border-white/15 bg-white/5 py-2.5 text-sm font-medium text-stone-300 backdrop-blur-sm",
                        FOCUS_RING
                      )}
                    >
                      <LogIn className="size-4" />
                      Sign in
                    </Link>
                  </>
                )}
                <Link
                  href="/book"
                  onClick={() => setOpen(false)}
                  className={cn(
                    "mt-1 flex items-center justify-center gap-2 rounded-full bg-gradient-to-r from-[#EDEFF2] via-[#C9CDD3] to-[#A9AEB8] py-2.5 text-sm font-semibold text-black transition-transform duration-200 active:scale-[0.98]",
                    FOCUS_RING
                  )}
                >
                  Book Now →
                </Link>
              </motion.div>
            </nav>
          </motion.div>
        )}
      </AnimatePresence>
    </header>
  );
}