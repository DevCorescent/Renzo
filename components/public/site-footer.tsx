// OWNER: Gauransh | COMPONENT: Public site footer
//
// Content-driven: every string, link and social handle comes from the CMS
// document the public layout resolves. There is deliberately NO second copy of
// the default copy here — `getPublishedHomeContent()` already falls back to
// lib/cms/defaults.ts, so a duplicate set of literals could only drift from it.
//
// Layout, spacing and colour are untouched and unreachable from the CMS.
import Link from "next/link";
import Image from "next/image";
import { Scissors, MapPin, Phone, Mail } from "lucide-react";
import { socialIcon } from "@/lib/cms/icons";
import type { Branding, FooterContent } from "@/lib/cms/schema";

export function SiteFooter({
  branding,
  footer,
}: {
  branding: Branding;
  footer: FooterContent;
}) {
  // A footer-specific logo wins; otherwise the site logo; otherwise the built-in
  // scissors mark. An empty CMS therefore never blanks the brand.
  const logoUrl = branding.footerLogoImage.url.trim() || branding.logoImage.url.trim();

  return (
    <footer className="border-t border-white/10 bg-stone-950 text-stone-300">
      <div className="mx-auto max-w-7xl px-4 py-16 sm:px-6 lg:px-8">
        <div className="grid gap-12 md:grid-cols-2 lg:grid-cols-4">
          {/* Brand */}
          <div className="space-y-4">
            <Link href="/" className="flex items-center gap-2.5">
              {logoUrl ? (
                <Image
                  src={logoUrl}
                  alt={branding.footerLogoImage.alt || branding.siteName}
                  width={36}
                  height={36}
                  className="size-9 rounded-full object-cover"
                />
              ) : (
                <span className="inline-flex size-9 items-center justify-center rounded-full bg-[#C4C9D1]/15 text-[#C4C9D1] ring-1 ring-[#C4C9D1]/30">
                  <Scissors className="size-4.5" />
                </span>
              )}
              <span className="font-heading text-2xl font-bold tracking-tight text-white">
                {branding.siteName}
              </span>
            </Link>
            <p className="max-w-xs text-sm leading-relaxed text-stone-400">{footer.tagline}</p>
            <div className="flex gap-3">
              {footer.socials.map((social) => {
                // Instagram / WhatsApp / Facebook resolve to the exact marks this
                // footer has always rendered — see lib/cms/icons.ts.
                const Icon = socialIcon(social.icon);
                return (
                  <a
                    key={social.id}
                    href={social.href}
                    aria-label={social.label}
                    className="inline-flex size-9 items-center justify-center rounded-lg border border-white/10 text-stone-400 transition-colors hover:border-[#C4C9D1]/40 hover:text-[#C4C9D1]"
                  >
                    <Icon className="size-4" />
                  </a>
                );
              })}
            </div>
          </div>

          {/* Link columns */}
          {footer.columns.map((column) => (
            <div key={column.id}>
              <h4 className="mb-4 text-xs font-semibold uppercase tracking-[0.2em] text-white">
                {column.title}
              </h4>
              <ul className="space-y-3">
                {column.links.map((link) => (
                  <li key={link.id}>
                    <Link
                      href={link.href}
                      className="text-sm text-stone-400 transition-colors hover:text-[#C4C9D1]"
                    >
                      {link.label}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          ))}

          {/* Contact */}
          <div>
            <h4 className="mb-4 text-xs font-semibold uppercase tracking-[0.2em] text-white">
              {footer.contactTitle}
            </h4>
            <ul className="space-y-3 text-sm text-stone-400">
              <li className="flex items-start gap-2">
                <MapPin className="mt-0.5 size-4 shrink-0 text-[#C4C9D1]" />
                <span>{footer.address}</span>
              </li>
              <li className="flex items-center gap-2">
                <Phone className="size-4 shrink-0 text-[#C4C9D1]" />
                <span>{footer.phone}</span>
              </li>
              <li className="flex items-center gap-2">
                <Mail className="size-4 shrink-0 text-[#C4C9D1]" />
                <span>{footer.email}</span>
              </li>
            </ul>
          </div>
        </div>

        <div className="mt-12 flex flex-col items-center justify-between gap-4 border-t border-white/10 pt-8 text-xs text-stone-500 sm:flex-row">
          {/* The year stays live — it is never authored, so it can never go stale. */}
          <p>&copy; {new Date().getFullYear()} {footer.copyright}</p>
          <div className="flex gap-6">
            {footer.legalLinks.map((link) => (
              <Link key={link.id} href={link.href} className="transition-colors hover:text-[#C4C9D1]">
                {link.label}
              </Link>
            ))}
          </div>
        </div>
      </div>
    </footer>
  );
}
