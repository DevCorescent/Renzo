import Link from "next/link";
import { MapPin, Phone, Mail } from "lucide-react";
import { ContactForm } from "@/components/public/contact-form";
import { CONTACT_INFO } from "@/components/public/home/home-data";

export const metadata = {
  title: "Contact — Renzo",
  description: "Get in touch with Renzo. Bookings, questions, and salon enquiries welcome.",
};

export default function ContactPage() {
  return (
    <div className="min-h-screen bg-stone-950 text-stone-100">
      <div className="border-b border-white/5 bg-stone-900/60 py-14 text-center">
        <h1 className="text-3xl font-bold tracking-tight sm:text-4xl">Contact Us</h1>
        <p className="mt-3 text-stone-400">We&apos;d love to hear from you</p>
      </div>

      <div className="mx-auto max-w-5xl px-4 py-12 sm:px-6">
        <div className="grid gap-10 lg:grid-cols-2">
          <div>
            <h2 className="font-heading text-2xl font-bold tracking-tight">Renzo</h2>
            <p className="mt-3 max-w-sm leading-relaxed text-stone-400">{CONTACT_INFO.tagline}</p>

            <ul className="mt-8 space-y-4 text-sm text-stone-300">
              <li className="flex items-start gap-3">
                <MapPin className="mt-0.5 size-5 shrink-0 text-amber-500/70" />
                {CONTACT_INFO.address}
              </li>
              <li className="flex items-center gap-3">
                <Phone className="size-5 shrink-0 text-amber-500/70" />
                <a href={`tel:${CONTACT_INFO.phone.replace(/\s/g, "")}`} className="transition hover:text-amber-400">
                  {CONTACT_INFO.phone}
                </a>
              </li>
              <li className="flex items-center gap-3">
                <Mail className="size-5 shrink-0 text-amber-500/70" />
                <a href={`mailto:${CONTACT_INFO.email}`} className="transition hover:text-amber-400">
                  {CONTACT_INFO.email}
                </a>
              </li>
            </ul>

            <p className="mt-8 text-xs text-stone-500">
              Prefer to book online?{" "}
              <Link href="/book" className="text-amber-400 transition hover:text-amber-300">
                Open the booking wizard →
              </Link>
            </p>
          </div>

          <div className="rounded-2xl border border-white/8 bg-stone-900 p-6 sm:p-8">
            <h2 className="mb-6 text-lg font-semibold">Send a message</h2>
            <ContactForm />
          </div>
        </div>
      </div>
    </div>
  );
}
