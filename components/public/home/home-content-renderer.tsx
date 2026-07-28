import { Hero } from "@/components/public/home/hero";
import { Experience } from "@/components/public/home/experience";
import { Services } from "@/components/public/home/services";
import { Benefits } from "@/components/public/home/benefits";
import { Gallery } from "@/components/public/home/gallery";
import { Pricing } from "@/components/public/home/pricing";
import { Blog } from "@/components/public/home/blog";
import { Testimonials } from "@/components/public/home/testimonials";
import { Contact } from "@/components/public/home/contact";
import { FaqSection } from "@/components/public/home/faq";
import type { HomeContent } from "@/lib/cms/schema";

export function HomeContentRenderer({ content }: { content: HomeContent }) {
  return (
    <main className="bg-stone-950">
      {content.sections
        .filter((section) => section.enabled)
        .map((section) => {
          switch (section.type) {
            case "HERO":
              return <Hero key={section.id} data={section.data} branding={content.branding} />;
            case "EXPERIENCE":
              return <Experience key={section.id} data={section.data} />;
            case "SERVICES":
              return <Services key={section.id} data={section.data} />;
            case "BENEFITS":
              return <Benefits key={section.id} data={section.data} />;
            case "GALLERY":
              return <Gallery key={section.id} data={section.data} />;
            case "PRICING":
              return <Pricing key={section.id} data={section.data} />;
            case "BLOG":
              return <Blog key={section.id} data={section.data} />;
            case "TESTIMONIALS":
              return <Testimonials key={section.id} data={section.data} />;
            case "FAQ":
              return <FaqSection key={section.id} data={section.data} />;
            case "CONTACT":
              return <Contact key={section.id} data={section.data} />;
            default:
              return null;
          }
        })}
    </main>
  );
}
