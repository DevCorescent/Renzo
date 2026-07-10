// OWNER: Gauransh | SECTION: Contact (split info + booking enquiry panel)
import Link from "next/link";
import Image from "next/image";
import { MapPin, Phone, Mail } from "lucide-react";
import { buttonVariants } from "@/components/ui/button";
import { PILL_SOLID } from "./home-ui";
import { MotionReveal } from "./motion";
import { cn } from "@/lib/utils";
import { CONTACT_IMAGE, CONTACT_INFO } from "./home-data";

function Field({
  id,
  label,
  type,
  placeholder,
}: {
  id: string;
  label: string;
  type: string;
  placeholder: string;
}) {
  return (
    <div>
      <label htmlFor={id} className="mb-1.5 block text-xs font-medium text-stone-300">
        {label} <span className="text-gold">*</span>
      </label>
      <input
        id={id}
        name={id}
        type={type}
        placeholder={placeholder}
        className="w-full rounded-full border border-white/15 bg-white/5 px-4 py-2.5 text-sm text-white outline-none transition-colors placeholder:text-stone-500 focus:border-gold/50"
      />
    </div>
  );
}

export function Contact() {
  return (
    <section id="contact" className="bg-stone-950 pb-24">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="relative overflow-hidden rounded-3xl ring-1 ring-white/10">
          <Image
            src={CONTACT_IMAGE}
            alt=""
            fill
            sizes="100vw"
            className="object-cover"
          />
          <div aria-hidden className="absolute inset-0 bg-stone-950/85" />

          <div className="relative grid gap-10 p-8 sm:p-12 lg:grid-cols-2 lg:gap-16">
            {/* Studio details */}
            <MotionReveal className="flex flex-col justify-center gap-6">
              <h2 className="font-heading text-4xl font-extrabold tracking-tight text-white sm:text-5xl">
                Renzo
              </h2>
              <p className="max-w-sm leading-relaxed text-stone-300">{CONTACT_INFO.tagline}</p>
              <ul className="space-y-4 text-sm text-stone-300">
                <li className="flex items-start gap-3">
                  <MapPin className="mt-0.5 size-5 shrink-0 text-gold" />
                  {CONTACT_INFO.address}
                </li>
                <li className="flex items-center gap-3">
                  <Phone className="size-5 shrink-0 text-gold" />
                  {CONTACT_INFO.phone}
                </li>
                <li className="flex items-center gap-3">
                  <Mail className="size-5 shrink-0 text-gold" />
                  {CONTACT_INFO.email}
                </li>
              </ul>
            </MotionReveal>

            {/* Booking enquiry */}
            <MotionReveal
              delay={0.1}
              className="rounded-2xl border border-white/10 bg-stone-950/60 p-6 backdrop-blur sm:p-8"
            >
              <div role="group" aria-label="Booking enquiry" className="space-y-5">
                <Field id="contact-name" label="Name" type="text" placeholder="Full name" />
                <Field id="contact-phone" label="Phone" type="tel" placeholder="Phone number" />
                <Field id="contact-email" label="Email" type="email" placeholder="you@email.com" />
                <Link
                  href="/book"
                  className={cn(buttonVariants({ size: "lg" }), PILL_SOLID, "w-full")}
                >
                  Book Now
                </Link>
              </div>
            </MotionReveal>
          </div>
        </div>
      </div>
    </section>
  );
}
