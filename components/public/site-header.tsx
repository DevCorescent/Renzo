"use client";

// OWNER: Gauransh | COMPONENT: Public site header (nav bar)
import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Scissors, Menu, X, LayoutDashboard, LogIn, UserPlus } from "lucide-react";
import { useScrolled } from "@/lib/hooks/use-scrolled";
import { cn } from "@/lib/utils";

export const PUBLIC_NAV_LINKS = [
  { label: "Home",     href: "/" },
  { label: "Services", href: "/services" },
  { label: "Branches", href: "/branches" },
  { label: "Gallery",  href: "/gallery" },
  { label: "Pricing",  href: "/packages" },
];

function isActiveLink(pathname: string, href: string): boolean {
  return href === "/" ? pathname === "/" : pathname.startsWith(href);
}

interface SiteHeaderProps {
  /** Passed from a Server Component — non-null means user is already logged in */
  dashboardHref?: string | null;
}

export function SiteHeader({ dashboardHref }: SiteHeaderProps = {}) {
  const [open, setOpen] = useState(false);
  const pathname = usePathname();
  const scrolled = useScrolled(12);

  return (
    <header
      className={cn(
        "sticky top-0 z-50 w-full text-stone-100 transition-all duration-300",
        scrolled || open
          ? "border-b border-white/10 bg-stone-950/90 backdrop-blur-md"
          : "border-b border-transparent bg-stone-950/30 backdrop-blur-sm",
      )}
    >
      <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-4 sm:px-6 lg:h-18 lg:px-8">
        {/* Logo */}
        <Link
          href="/"
          className="group flex items-center gap-2"
          onClick={() => setOpen(false)}
        >
          <span className="inline-flex size-8 items-center justify-center rounded-full bg-gold/15 text-gold ring-1 ring-gold/30 transition-colors group-hover:bg-gold/25">
            <Scissors className="size-4" />
          </span>
          <span className="font-heading text-2xl font-bold tracking-tight text-white">Renzo</span>
        </Link>

        {/* Desktop nav */}
        <nav className="hidden items-center gap-7 lg:flex">
          {PUBLIC_NAV_LINKS.map((link) => {
            const active = isActiveLink(pathname, link.href);
            return (
              <Link
                key={link.href}
                href={link.href}
                aria-current={active ? "page" : undefined}
                className={cn(
                  "group relative text-sm font-medium transition-colors",
                  active ? "text-white" : "text-stone-300 hover:text-white",
                )}
              >
                {link.label}
                <span
                  className={cn(
                    "absolute -bottom-1.5 left-0 h-px bg-gold transition-all duration-300",
                    active ? "w-full" : "w-0 group-hover:w-full",
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
                className="flex items-center gap-1.5 rounded-full bg-gold/10 px-4 py-2 text-sm font-medium text-gold ring-1 ring-gold/25 transition hover:bg-gold/20"
              >
                <LayoutDashboard className="size-3.5" />
                Dashboard
              </Link>
              <Link
                href="/book"
                className="flex items-center gap-1.5 rounded-full bg-gold px-4 py-2 text-sm font-semibold text-stone-950 transition hover:bg-amber-400"
              >
                Book Now
              </Link>
            </>
          ) : (
            <>
              <Link
                href="/login"
                className="flex items-center gap-1.5 rounded-full px-4 py-2 text-sm font-medium text-stone-300 transition hover:text-white"
              >
                <LogIn className="size-3.5" />
                Sign in
              </Link>
              <Link
                href="/signup"
                className="flex items-center gap-1.5 rounded-full border border-white/15 bg-white/5 px-4 py-2 text-sm font-medium text-stone-200 transition hover:bg-white/10"
              >
                <UserPlus className="size-3.5" />
                Sign up
              </Link>
              <Link
                href="/book"
                className="flex items-center gap-1.5 rounded-full bg-gold px-4 py-2 text-sm font-semibold text-stone-950 transition hover:bg-amber-400"
              >
                Book Now
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
          className="inline-flex size-10 items-center justify-center text-white lg:hidden"
        >
          {open ? <X className="size-6" /> : <Menu className="size-6" />}
        </button>
      </div>

      {/* Mobile menu */}
      {open && (
        <div
          id="mobile-menu"
          className="border-t border-white/10 bg-stone-950 duration-300 animate-in fade-in slide-in-from-top-2 lg:hidden"
        >
          <nav className="mx-auto flex max-w-7xl flex-col px-4 py-4 sm:px-6">
            {PUBLIC_NAV_LINKS.map((link) => {
              const active = isActiveLink(pathname, link.href);
              return (
                <Link
                  key={link.href}
                  href={link.href}
                  onClick={() => setOpen(false)}
                  aria-current={active ? "page" : undefined}
                  className={cn(
                    "border-b border-white/10 py-3 text-sm font-medium transition-colors",
                    active ? "text-white" : "text-stone-300 hover:text-white",
                  )}
                >
                  {link.label}
                </Link>
              );
            })}

            <div className="mt-4 flex flex-col gap-2">
              {dashboardHref ? (
                <Link
                  href={dashboardHref}
                  onClick={() => setOpen(false)}
                  className="flex items-center justify-center gap-2 rounded-full bg-gold/10 py-2.5 text-sm font-medium text-gold ring-1 ring-gold/25"
                >
                  <LayoutDashboard className="size-4" />
                  Go to Dashboard
                </Link>
              ) : (
                <>
                  <Link
                    href="/signup"
                    onClick={() => setOpen(false)}
                    className="flex items-center justify-center gap-2 rounded-full bg-white py-2.5 text-sm font-semibold text-stone-900"
                  >
                    <UserPlus className="size-4" />
                    Create account
                  </Link>
                  <Link
                    href="/login"
                    onClick={() => setOpen(false)}
                    className="flex items-center justify-center gap-2 rounded-full border border-white/10 py-2.5 text-sm font-medium text-stone-300"
                  >
                    <LogIn className="size-4" />
                    Sign in
                  </Link>
                </>
              )}
              <Link
                href="/book"
                onClick={() => setOpen(false)}
                className="mt-1 flex items-center justify-center gap-2 rounded-full bg-gold py-2.5 text-sm font-semibold text-stone-950"
              >
                Book Now →
              </Link>
            </div>
          </nav>
        </div>
      )}
    </header>
  );
}
