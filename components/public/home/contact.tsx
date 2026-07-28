// OWNER: Gauransh | SECTION: Contact (split info + booking enquiry panel)
import Link from "next/link";
import Image from "next/image";
import { MapPin, Phone, Mail } from "lucide-react";
import { buttonVariants } from "@/components/ui/button";
import { PILL_SOLID } from "./home-ui";
import { MotionReveal } from "./motion";
import { cn } from "@/lib/utils";
import type { ContactData } from "@/lib/cms/schema";

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
        className="w-full rounded-full border border-white/15 bg-white/5 px-4 py-2.5 text-sm text-white outline-none transition-colors placeholder:text-stone-400/80 focus:border-gold/50 focus:bg-white/[0.07]"
      />
    </div>
  );
}

export function Contact({ data }: { data: ContactData }) {
  return (
    <section id="contact" className="bg-stone-950 pb-24">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="relative overflow-hidden rounded-3xl ring-1 ring-white/10">
          <Image
            src={data.backgroundImage.url}
            alt=""
            fill
            sizes="100vw"
            className="object-cover"
          />
          <div aria-hidden className="absolute inset-0 bg-stone-950/85" />

          <div className="relative grid gap-10 p-6 sm:p-8 lg:grid-cols-2 lg:gap-16 lg:p-12">
            <MotionReveal className="flex min-w-0 flex-col justify-center gap-6">
              <h2 className="whitespace-nowrap font-heading text-2xl font-semibold tracking-tight text-white sm:text-3xl md:text-4xl">
                {data.title}
              </h2>
              <p className="max-w-sm break-words leading-relaxed text-stone-300">
                {data.tagline}
              </p>
              <ul className="space-y-4 text-sm text-stone-300">
                <li className="flex items-start gap-3">
                  <MapPin className="mt-0.5 size-5 shrink-0 text-gold" />
                  <span className="break-words">{data.address}</span>
                </li>
                <li className="flex items-center gap-3">
                  <Phone className="size-5 shrink-0 text-gold" />
                  <span className="break-words">{data.phone}</span>
                </li>
                <li className="flex items-center gap-3">
                  <Mail className="size-5 shrink-0 text-gold" />
                  <span className="break-words">{data.email}</span>
                </li>
              </ul>
            </MotionReveal>

            <MotionReveal
              delay={0.1}
              className="rounded-2xl border border-white/10 bg-stone-950/60 p-5 backdrop-blur sm:p-6 md:p-8"
            >
              <div role="group" aria-label={data.formTitle} className="space-y-5">
                <Field id="contact-name" label={data.nameLabel} type="text" placeholder={data.namePlaceholder} />
                <Field id="contact-phone" label={data.phoneLabel} type="tel" placeholder={data.phonePlaceholder} />
                <Field id="contact-email" label={data.emailLabel} type="email" placeholder={data.emailPlaceholder} />
                <div className="pt-2">
                  <Link
                    href={data.cta.href}
                    className={cn(buttonVariants({ size: "lg" }), PILL_SOLID, "w-full")}
                  >
                    {data.cta.label}
                  </Link>
                </div>
              </div>
            </MotionReveal>
          </div>
        </div>
      </div>
    </section>
  );
}