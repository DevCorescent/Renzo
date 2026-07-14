// OWNER: Gauransh | COMPONENT: Public site footer
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

const SOCIALS = [
  { Icon: Camera, label: "Instagram" },
  { Icon: MessageCircle, label: "WhatsApp" },
  { Icon: Share2, label: "Facebook" },
];

export function SiteFooter() {
  return (
    <footer className="border-t border-white/10 bg-stone-950 text-stone-300">
      <div className="mx-auto max-w-7xl px-4 py-16 sm:px-6 lg:px-8">
        <div className="grid gap-12 md:grid-cols-2 lg:grid-cols-4">
          {/* Brand */}
          <div className="space-y-4">
            <Link href="/" className="flex items-center gap-2.5">
              <span className="inline-flex size-9 items-center justify-center rounded-full bg-[#C4C9D1]/15 text-[#C4C9D1] ring-1 ring-[#C4C9D1]/30">
                <Scissors className="size-4.5" />
              </span>
              <span className="font-heading text-2xl font-bold tracking-tight text-white">Renzo</span>
            </Link>
            <p className="max-w-xs text-sm leading-relaxed text-stone-400">
              A modern hair &amp; beauty studio crafting confidence, one cut at a time.
            </p>
            <div className="flex gap-3">
              {SOCIALS.map(({ Icon, label }) => (
                <a
                  key={label}
                  href="#"
                  aria-label={label}
                  className="inline-flex size-9 items-center justify-center rounded-lg border border-white/10 text-stone-400 transition-colors hover:border-[#C4C9D1]/40 hover:text-[#C4C9D1]"
                >
                  <Icon className="size-4" />
                </a>
              ))}
            </div>
          </div>

          {/* Link columns */}
          {Object.entries(FOOTER_LINKS).map(([title, links]) => (
            <div key={title}>
              <h4 className="mb-4 text-xs font-semibold uppercase tracking-[0.2em] text-white">
                {title}
              </h4>
              <ul className="space-y-3">
                {links.map((link) => (
                  <li key={link.href}>
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
              Visit Us
            </h4>
            <ul className="space-y-3 text-sm text-stone-400">
              <li className="flex items-start gap-2">
                <MapPin className="mt-0.5 size-4 shrink-0 text-[#C4C9D1]" />
                <span>12 Rosewood Avenue, Bandra West, Mumbai 400050</span>
              </li>
              <li className="flex items-center gap-2">
                <Phone className="size-4 shrink-0 text-[#C4C9D1]" />
                <span>+91 98765 43210</span>
              </li>
              <li className="flex items-center gap-2">
                <Mail className="size-4 shrink-0 text-[#C4C9D1]" />
                <span>hello@renzo.salon</span>
              </li>
            </ul>
          </div>
        </div>

        <div className="mt-12 flex flex-col items-center justify-between gap-4 border-t border-white/10 pt-8 text-xs text-stone-500 sm:flex-row">
          <p>&copy; {new Date().getFullYear()} Renzo Salon. All rights reserved.</p>
          <div className="flex gap-6">
            <Link href="#" className="transition-colors hover:text-[#C4C9D1]">Privacy Policy</Link>
            <Link href="#" className="transition-colors hover:text-[#C4C9D1]">Terms of Service</Link>
          </div>
        </div>
      </div>
    </footer>
  );
}