// OWNER: Devanshi | COMPONENT: Public site footer
import Link from "next/link";
import { Scissors, MapPin, Phone, Mail, Camera, MessageCircle, Share2 } from "lucide-react";

const FOOTER_LINKS = {
  Explore: [
    { label: "Services", href: "/services" },
    { label: "Stylists", href: "/stylists" },
    { label: "Packages", href: "/packages" },
    { label: "Gallery", href: "/gallery" },
    { label: "Offers", href: "/offers" },
  ],
  Company: [
    { label: "About Us", href: "/#about" },
    { label: "Branches", href: "/branches" },
    { label: "Blog", href: "/blog" },
    { label: "Contact", href: "/contact" },
    { label: "Book Now", href: "/book" },
  ],
};

export function SiteFooter() {
  return (
    <footer className="border-t border-border bg-muted/40">
      <div className="mx-auto max-w-7xl px-4 py-16 sm:px-6 lg:px-8">
        <div className="grid gap-12 md:grid-cols-2 lg:grid-cols-4">
          {/* Brand */}
          <div className="space-y-4">
            <Link href="/" className="flex items-center gap-2">
              <Scissors className="size-6 text-primary" />
              <span className="font-heading text-2xl font-bold tracking-tight">Renzo</span>
            </Link>
            <p className="max-w-xs text-sm leading-relaxed text-muted-foreground">
              A modern hair &amp; beauty studio crafting confidence, one cut at a time.
            </p>
            <div className="flex gap-3">
              {[Camera, MessageCircle, Share2].map((Icon, i) => (
                <a
                  key={i}
                  href="#"
                  aria-label="Social link"
                  className="inline-flex size-9 items-center justify-center border border-border text-muted-foreground transition-colors hover:border-primary hover:text-foreground"
                >
                  <Icon className="size-4" />
                </a>
              ))}
            </div>
          </div>

          {/* Link columns */}
          {Object.entries(FOOTER_LINKS).map(([title, links]) => (
            <div key={title}>
              <h4 className="mb-4 text-xs font-semibold uppercase tracking-widest text-foreground">
                {title}
              </h4>
              <ul className="space-y-3">
                {links.map((link) => (
                  <li key={link.href}>
                    <Link
                      href={link.href}
                      className="text-sm text-muted-foreground transition-colors hover:text-foreground"
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
            <h4 className="mb-4 text-xs font-semibold uppercase tracking-widest text-foreground">
              Visit Us
            </h4>
            <ul className="space-y-3 text-sm text-muted-foreground">
              <li className="flex items-start gap-2">
                <MapPin className="mt-0.5 size-4 shrink-0 text-primary" />
                <span>12 Rosewood Avenue, Bandra West, Mumbai 400050</span>
              </li>
              <li className="flex items-center gap-2">
                <Phone className="size-4 shrink-0 text-primary" />
                <span>+91 98765 43210</span>
              </li>
              <li className="flex items-center gap-2">
                <Mail className="size-4 shrink-0 text-primary" />
                <span>hello@renzo.salon</span>
              </li>
            </ul>
          </div>
        </div>

        <div className="mt-12 flex flex-col items-center justify-between gap-4 border-t border-border pt-8 text-xs text-muted-foreground sm:flex-row">
          <p>&copy; {new Date().getFullYear()} Renzo Salon. All rights reserved.</p>
          <div className="flex gap-6">
            <Link href="#" className="transition-colors hover:text-foreground">Privacy Policy</Link>
            <Link href="#" className="transition-colors hover:text-foreground">Terms of Service</Link>
          </div>
        </div>
      </div>
    </footer>
  );
}
