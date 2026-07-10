"use client";

// OWNER: Gauransh | COMPONENT: Public site header (nav bar)
import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Scissors, Menu, X } from "lucide-react";
import { buttonVariants } from "@/components/ui/button";
import { useScrolled } from "@/lib/hooks/use-scrolled";
import { PILL_SOLID } from "@/components/public/home/home-ui";
import { cn } from "@/lib/utils";

export const PUBLIC_NAV_LINKS = [
  { label: "Home", href: "/" },
  { label: "About Us", href: "/#about" },
  { label: "Services", href: "/services" },
  { label: "Gallery", href: "/gallery" },
  { label: "Pricing", href: "/packages" },
];

function isActiveLink(pathname: string, href: string): boolean {
  return href === "/" ? pathname === "/" : pathname.startsWith(href);
}

export function SiteHeader() {
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
        <nav className="hidden items-center gap-8 lg:flex">
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

        {/* Desktop actions */}
        <div className="hidden items-center lg:flex">
          <Link href="/contact" className={cn(buttonVariants({ size: "sm" }), PILL_SOLID, "px-6")}>
            Contact
          </Link>
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
                    active
                      ? "text-white"
                      : "text-stone-300 hover:text-white",
                  )}
                >
                  {link.label}
                </Link>
              );
            })}
            <div className="mt-4 flex flex-col gap-2">
              <Link
                href="/contact"
                onClick={() => setOpen(false)}
                className={cn(buttonVariants(), PILL_SOLID)}
              >
                Contact
              </Link>
            </div>
          </nav>
        </div>
      )}
    </header>
  );
}
