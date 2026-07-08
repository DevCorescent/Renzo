import Link from "next/link";
import {
  Scissors,
  Sparkles,
  Star,
  Clock,
  MapPin,
  ArrowRight,
  Brush,
  Droplets,
  Flower2,
  Wand2,
} from "lucide-react";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";

// OWNER: Devanshi | MODULE: Homepage
// Hardcoded (Phase 1). Sections: Hero, Stats, Services, About, Stylists,
//           Gallery, Testimonials, FAQ, CTA. Header + Footer live in the layout.

const SERVICES = [
  { icon: Scissors, name: "Haircut & Styling", desc: "Precision cuts and blow-dry finishes tailored to your face and hair type.", price: "from ₹499" },
  { icon: Droplets, name: "Hair Colour", desc: "Global colour, highlights and balayage using ammonia-free premium brands.", price: "from ₹1,999" },
  { icon: Flower2, name: "Spa & Treatments", desc: "Deep-conditioning, keratin and scalp therapies for healthier hair.", price: "from ₹1,299" },
  { icon: Brush, name: "Makeup & Bridal", desc: "Party, HD and bridal makeup by senior artists for your big moments.", price: "from ₹2,499" },
  { icon: Wand2, name: "Smoothening", desc: "Frizz-free, salon-smooth hair with long-lasting nourishing formulas.", price: "from ₹3,499" },
  { icon: Sparkles, name: "Nails & Grooming", desc: "Manicure, pedicure and grooming essentials in a relaxing setting.", price: "from ₹699" },
];

const STYLISTS = [
  { name: "Aisha Kapoor", role: "Creative Director", img: "https://images.unsplash.com/photo-1595959183082-7b570b7e08e2?auto=format&fit=crop&w=600&q=80" },
  { name: "Rohan Mehta", role: "Senior Colourist", img: "https://images.unsplash.com/photo-1622253692010-333f2da6031d?auto=format&fit=crop&w=600&q=80" },
  { name: "Neha Verma", role: "Bridal Specialist", img: "https://images.unsplash.com/photo-1487412720507-e7ab37603c6f?auto=format&fit=crop&w=600&q=80" },
  { name: "Kabir Singh", role: "Style Consultant", img: "https://images.unsplash.com/photo-1618077360395-f3068be8e001?auto=format&fit=crop&w=600&q=80" },
];

const GALLERY = [
  "https://images.unsplash.com/photo-1560066984-138dadb4c035?auto=format&fit=crop&w=500&q=80",
  "https://images.unsplash.com/photo-1521590832167-7bcbfaa6381f?auto=format&fit=crop&w=500&q=80",
  "https://images.unsplash.com/photo-1522337660859-02fbefca4702?auto=format&fit=crop&w=500&q=80",
  "https://images.unsplash.com/photo-1633681926022-84c23e8cb2d6?auto=format&fit=crop&w=500&q=80",
  "https://images.unsplash.com/photo-1580618672591-eb180b1a973f?auto=format&fit=crop&w=500&q=80",
  "https://images.unsplash.com/photo-1519415943484-9fa1873496d4?auto=format&fit=crop&w=500&q=80",
];

const TESTIMONIALS = [
  { name: "Priya S.", text: "Best salon experience I've had in the city. My balayage came out exactly like the reference — I get compliments everywhere!", rating: 5 },
  { name: "Arjun M.", text: "Walked in for a quick trim and left with the sharpest cut of my life. The team genuinely knows their craft.", rating: 5 },
  { name: "Deepa R.", text: "Booked the bridal package for my wedding. Professional, punctual and made me feel like a queen. Highly recommend.", rating: 5 },
];

const FAQS = [
  { q: "Do I need to book in advance?", a: "Walk-ins are welcome, but we recommend booking online to guarantee your preferred stylist and time slot." },
  { q: "Which products do you use?", a: "We work with premium, cruelty-free professional brands and offer ammonia-free colour options across all branches." },
  { q: "Can I request a specific stylist?", a: "Absolutely. You can pick your favourite stylist during the booking flow, subject to their availability." },
  { q: "What is your cancellation policy?", a: "You can reschedule or cancel free of charge up to 4 hours before your appointment from your customer dashboard." },
];

export default function HomePage() {
  return (
    <main>
      {/* ── Hero ─────────────────────────────────────────────── */}
      <section className="relative overflow-hidden bg-gradient-to-b from-muted/60 to-background">
        <div className="mx-auto grid max-w-7xl items-center gap-12 px-4 py-20 sm:px-6 lg:grid-cols-2 lg:gap-8 lg:px-8 lg:py-28">
          <div className="space-y-8">
            <span className="inline-flex items-center gap-2 border border-border bg-background px-4 py-1.5 text-xs font-semibold uppercase tracking-widest text-muted-foreground">
              <Sparkles className="size-3.5 text-primary" />
              Award-winning hair &amp; beauty studio
            </span>
            <h1 className="font-heading text-5xl font-bold leading-[1.05] tracking-tight sm:text-6xl lg:text-7xl">
              Where your best <span className="italic text-primary">look</span> begins.
            </h1>
            <p className="max-w-md text-lg leading-relaxed text-muted-foreground">
              Expert cuts, colour and care from stylists who listen. Step into Renzo and
              leave feeling unmistakably you.
            </p>
            <div className="flex flex-wrap items-center gap-4">
              <Link href="/book" className={cn(buttonVariants({ size: "lg" }))}>
                Book an Appointment
                <ArrowRight className="size-4" />
              </Link>
              <Link href="/services" className={cn(buttonVariants({ variant: "outline", size: "lg" }))}>
                View Services
              </Link>
            </div>
            <div className="flex items-center gap-6 pt-4">
              <div className="flex -space-x-3">
                {STYLISTS.slice(0, 4).map((s) => (
                  <img
                    key={s.name}
                    src={s.img}
                    alt={s.name}
                    className="size-10 rounded-full border-2 border-background object-cover"
                  />
                ))}
              </div>
              <div className="text-sm">
                <div className="flex items-center gap-1 text-primary">
                  {Array.from({ length: 5 }).map((_, i) => (
                    <Star key={i} className="size-4 fill-current" />
                  ))}
                </div>
                <p className="text-muted-foreground">Loved by 12,000+ happy clients</p>
              </div>
            </div>
          </div>

          <div className="relative">
            <div className="aspect-[4/5] overflow-hidden rounded-t-[10rem] bg-muted">
              <img
                src="https://images.unsplash.com/photo-1560869713-7d0a29430803?auto=format&fit=crop&w=800&q=80"
                alt="Woman with beautifully styled hair at Renzo salon"
                className="size-full object-cover"
              />
            </div>
            <div className="absolute -bottom-6 -left-6 hidden w-52 border border-border bg-background p-5 shadow-lg sm:block">
              <div className="flex items-center gap-3">
                <Clock className="size-8 text-primary" />
                <div>
                  <p className="text-xs uppercase tracking-widest text-muted-foreground">Open daily</p>
                  <p className="font-heading text-lg font-semibold">9 AM – 9 PM</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ── Stats strip ──────────────────────────────────────── */}
      <section className="border-y border-border bg-primary text-primary-foreground">
        <div className="mx-auto grid max-w-7xl grid-cols-2 gap-8 px-4 py-12 sm:px-6 lg:grid-cols-4 lg:px-8">
          {[
            { value: "15+", label: "Years of expertise" },
            { value: "40+", label: "Expert stylists" },
            { value: "6", label: "Branches citywide" },
            { value: "12k+", label: "Happy clients" },
          ].map((stat) => (
            <div key={stat.label} className="text-center">
              <p className="font-heading text-4xl font-bold sm:text-5xl">{stat.value}</p>
              <p className="mt-2 text-sm uppercase tracking-widest text-primary-foreground/70">{stat.label}</p>
            </div>
          ))}
        </div>
      </section>

      {/* ── Services ─────────────────────────────────────────── */}
      <section className="mx-auto max-w-7xl px-4 py-24 sm:px-6 lg:px-8">
        <div className="mx-auto max-w-2xl text-center">
          <p className="text-xs font-semibold uppercase tracking-widest text-primary">What we do</p>
          <h2 className="mt-3 font-heading text-4xl font-bold tracking-tight sm:text-5xl">
            Services crafted for you
          </h2>
          <p className="mt-4 text-muted-foreground">
            From everyday grooming to special-occasion glam, our menu covers every look.
          </p>
        </div>

        <div className="mt-16 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {SERVICES.map((service) => (
            <div
              key={service.name}
              className="group flex flex-col border border-border bg-card p-8 transition-colors hover:border-primary"
            >
              <service.icon className="size-9 text-primary" />
              <h3 className="mt-6 font-heading text-xl font-semibold">{service.name}</h3>
              <p className="mt-3 flex-1 text-sm leading-relaxed text-muted-foreground">{service.desc}</p>
              <div className="mt-6 flex items-center justify-between border-t border-border pt-4">
                <span className="text-sm font-semibold">{service.price}</span>
                <Link
                  href="/services"
                  className="inline-flex items-center gap-1 text-xs font-semibold uppercase tracking-widest text-muted-foreground transition-colors group-hover:text-primary"
                >
                  Explore <ArrowRight className="size-3.5" />
                </Link>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* ── About / Why us ───────────────────────────────────── */}
      <section id="about" className="bg-muted/40">
        <div className="mx-auto grid max-w-7xl items-center gap-12 px-4 py-24 sm:px-6 lg:grid-cols-2 lg:px-8">
          <div className="grid grid-cols-2 gap-4">
            <img
              src="https://images.unsplash.com/photo-1503951914875-452162b0f3f1?auto=format&fit=crop&w=500&q=80"
              alt="Salon interior"
              className="mt-8 aspect-[3/4] w-full rounded-t-[6rem] object-cover"
            />
            <img
              src="https://images.unsplash.com/photo-1580489944761-15a19d654956?auto=format&fit=crop&w=500&q=80"
              alt="Client at Renzo"
              className="aspect-[3/4] w-full rounded-b-[6rem] object-cover"
            />
          </div>
          <div className="space-y-6">
            <p className="text-xs font-semibold uppercase tracking-widest text-primary">Why Renzo</p>
            <h2 className="font-heading text-4xl font-bold tracking-tight sm:text-5xl">
              More than a salon — a ritual of self-care.
            </h2>
            <p className="leading-relaxed text-muted-foreground">
              For over 15 years, Renzo has been the go-to destination for people who take their
              look seriously. Our stylists train continuously, our products are hand-picked, and
              every chair comes with a consultation — because great hair starts with really listening.
            </p>
            <ul className="space-y-4">
              {[
                "Certified, continuously-trained stylists",
                "Premium, cruelty-free products",
                "Hygienic, sanitised tools every session",
                "Transparent pricing — no surprises",
              ].map((point) => (
                <li key={point} className="flex items-center gap-3">
                  <span className="inline-flex size-6 shrink-0 items-center justify-center rounded-full bg-primary text-primary-foreground">
                    <Sparkles className="size-3.5" />
                  </span>
                  <span className="text-sm font-medium">{point}</span>
                </li>
              ))}
            </ul>
            <Link href="/branches" className={cn(buttonVariants())}>
              <MapPin className="size-4" />
              Find a branch near you
            </Link>
          </div>
        </div>
      </section>

      {/* ── Stylists ─────────────────────────────────────────── */}
      <section className="mx-auto max-w-7xl px-4 py-24 sm:px-6 lg:px-8">
        <div className="flex flex-col items-end justify-between gap-6 sm:flex-row">
          <div className="max-w-xl">
            <p className="text-xs font-semibold uppercase tracking-widest text-primary">The team</p>
            <h2 className="mt-3 font-heading text-4xl font-bold tracking-tight sm:text-5xl">
              Meet your stylists
            </h2>
          </div>
          <Link href="/stylists" className={cn(buttonVariants({ variant: "outline" }))}>
            View all stylists
          </Link>
        </div>

        <div className="mt-16 grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
          {STYLISTS.map((stylist) => (
            <Link key={stylist.name} href="/stylists" className="group block">
              <div className="aspect-[3/4] overflow-hidden bg-muted">
                <img
                  src={stylist.img}
                  alt={stylist.name}
                  className="size-full object-cover transition-transform duration-500 group-hover:scale-105"
                />
              </div>
              <h3 className="mt-4 font-heading text-lg font-semibold">{stylist.name}</h3>
              <p className="text-sm text-muted-foreground">{stylist.role}</p>
            </Link>
          ))}
        </div>
      </section>

      {/* ── Gallery ──────────────────────────────────────────── */}
      <section className="bg-muted/40 py-24">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="mx-auto max-w-2xl text-center">
            <p className="text-xs font-semibold uppercase tracking-widest text-primary">Our work</p>
            <h2 className="mt-3 font-heading text-4xl font-bold tracking-tight sm:text-5xl">
              A look inside the studio
            </h2>
          </div>
          <div className="mt-16 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
            {GALLERY.map((src, i) => (
              <div
                key={i}
                className={cn(
                  "aspect-square overflow-hidden bg-muted",
                  i === 0 && "col-span-2 row-span-2 aspect-auto",
                )}
              >
                <img src={src} alt="Gallery" className="size-full object-cover transition-transform duration-500 hover:scale-105" />
              </div>
            ))}
          </div>
          <div className="mt-10 text-center">
            <Link href="/gallery" className={cn(buttonVariants({ variant: "outline" }))}>
              View full gallery
            </Link>
          </div>
        </div>
      </section>

      {/* ── Testimonials ─────────────────────────────────────── */}
      <section className="mx-auto max-w-7xl px-4 py-24 sm:px-6 lg:px-8">
        <div className="mx-auto max-w-2xl text-center">
          <p className="text-xs font-semibold uppercase tracking-widest text-primary">Kind words</p>
          <h2 className="mt-3 font-heading text-4xl font-bold tracking-tight sm:text-5xl">
            What our clients say
          </h2>
        </div>
        <div className="mt-16 grid gap-6 lg:grid-cols-3">
          {TESTIMONIALS.map((t) => (
            <figure key={t.name} className="flex flex-col border border-border bg-card p-8">
              <div className="flex gap-1 text-primary">
                {Array.from({ length: t.rating }).map((_, i) => (
                  <Star key={i} className="size-4 fill-current" />
                ))}
              </div>
              <blockquote className="mt-6 flex-1 text-sm leading-relaxed text-muted-foreground">
                &ldquo;{t.text}&rdquo;
              </blockquote>
              <figcaption className="mt-6 font-heading text-base font-semibold">{t.name}</figcaption>
            </figure>
          ))}
        </div>
      </section>

      {/* ── FAQ ──────────────────────────────────────────────── */}
      <section className="bg-muted/40 py-24">
        <div className="mx-auto max-w-3xl px-4 sm:px-6 lg:px-8">
          <div className="text-center">
            <p className="text-xs font-semibold uppercase tracking-widest text-primary">Good to know</p>
            <h2 className="mt-3 font-heading text-4xl font-bold tracking-tight sm:text-5xl">
              Frequently asked questions
            </h2>
          </div>
          <div className="mt-12 divide-y divide-border border-y border-border">
            {FAQS.map((faq) => (
              <details key={faq.q} className="group py-5">
                <summary className="flex cursor-pointer items-center justify-between font-heading text-lg font-semibold marker:content-['']">
                  {faq.q}
                  <ArrowRight className="size-4 text-primary transition-transform group-open:rotate-90" />
                </summary>
                <p className="mt-3 text-sm leading-relaxed text-muted-foreground">{faq.a}</p>
              </details>
            ))}
          </div>
        </div>
      </section>

      {/* ── CTA banner ───────────────────────────────────────── */}
      <section className="bg-primary text-primary-foreground">
        <div className="mx-auto flex max-w-7xl flex-col items-center gap-8 px-4 py-20 text-center sm:px-6 lg:px-8">
          <Scissors className="size-10" />
          <h2 className="max-w-2xl font-heading text-4xl font-bold tracking-tight sm:text-5xl">
            Ready for a look that turns heads?
          </h2>
          <p className="max-w-md text-primary-foreground/70">
            Book your appointment in under two minutes. Pick your stylist, service and slot — we&apos;ll handle the rest.
          </p>
          <Link
            href="/book"
            className={cn(
              buttonVariants({ variant: "secondary", size: "lg" }),
              "bg-background text-foreground hover:bg-background/90",
            )}
          >
            Book Now
            <ArrowRight className="size-4" />
          </Link>
        </div>
      </section>
    </main>
  );
}
