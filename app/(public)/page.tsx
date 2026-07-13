import { Hero } from "@/components/public/home/hero";
import { Experience } from "@/components/public/home/experience";
import { Services } from "@/components/public/home/services";
import { Benefits } from "@/components/public/home/benefits";
import { Gallery } from "@/components/public/home/gallery";
import { Pricing } from "@/components/public/home/pricing";
import { Blog } from "@/components/public/home/blog";
import { Testimonials } from "@/components/public/home/testimonials";
import { Contact } from "@/components/public/home/contact";

// ============================================================================
// OWNER  : Gauransh
// MODULE : Homepage
// ROUTE  : /
//
// SECTIONS (dark, Veloura-style clone)
// Hero → Experience (More Than a Salon + stats) → Signature Services →
// Benefits → Gallery → Pricing → Blog → Testimonials → Contact
//
// NOTES
// Composition only — each section lives in components/public/home/*, content is
// centralised in components/public/home/home-data.ts. Header + Footer live in
// the public layout.
// ============================================================================

export default function HomePage() {
  return (
    <main className="bg-stone-950">
      <Hero />
      <Experience />
      <Services />
      <Benefits />
      <Gallery />
      <Pricing />
      <Blog />
      <Testimonials />
      <Contact />
    </main>
  );
}
