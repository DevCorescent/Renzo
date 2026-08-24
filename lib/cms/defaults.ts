// ============================================================================
// OWNER  : Gauransh
// MODULE : Homepage CMS — default content
//
// THE CONTRACT OF THIS FILE
// This is a byte-for-byte transcription of what the homepage renders TODAY. It is
// the fallback used when nothing has ever been published, and the seed for the
// very first draft. As long as it matches the old hardcoded values, switching the
// homepage onto the CMS is a no-op for every visitor: same words, same images,
// same order.
//
// Values that already lived in components/public/home/home-data.ts are IMPORTED
// from there rather than retyped, so those two can never drift. Values that were
// inline in a section component are transcribed here with the JSX whitespace
// collapsed exactly as the browser collapses it.
// ============================================================================

import {
  HERO_IMAGE,
  STATS,
  SERVICES,
  STYLISTS,
  GALLERY,
  TESTIMONIALS,
  FAQS,
  STATS_BLURB,
  BENEFITS,
  PRICING_TIERS,
  BLOG_POSTS,
  CONTACT_IMAGE,
  CONTACT_INFO,
} from "@/components/public/home/home-data";

import type { HomeContent, IconName, Section, SectionType } from "./schema";

/** Icons for BENEFITS, in the order the section renders them. */
const BENEFIT_ICONS: IconName[] = ["Scissors", "Gem", "Star"];

const HERO_SECTION: Section = {
  id: "sec-hero",
  type: "HERO",
  label: "",
  enabled: true,
  data: {
    eyebrow: "Luxury Hair & Beauty Studio",
    titleLead: "Where Beauty",
    titleMiddle: "Meets",
    titleAccent: "Confidence",
    paragraph:
      "Luxury haircuts, premium colouring, skin treatments and personalised styling — crafted with precision by expert stylists, for a look that carries into everything you do.",
    primaryCta: { label: "Book Appointment", href: "/book" },
    secondaryCta: { label: "Explore Services", href: "/services" },
    ratingValue: "4.5",
    trustLine: "15,000+ happy clients",
    scrollLabel: "Scroll",
    watermarkText: "RENZO",
    backgroundImage: {
      url: HERO_IMAGE,
      alt: "Luxury salon interior with a professional hairstylist styling a client at Renzo.",
    },
    // The four faces in the trust row — the same slice the hero already renders.
    avatars: STYLISTS.slice(0, 4).map((s, i) => ({
      id: `hero-avatar-${i + 1}`,
      url: s.img,
      alt: s.name,
    })),
    stats: [
      { id: "hero-stat-1", value: "15K+", label: "Happy Clients" },
      { id: "hero-stat-2", value: "12+", label: "Years Experience" },
      { id: "hero-stat-3", value: "4.5", label: "Google Rating" },
      { id: "hero-stat-4", value: "40+", label: "Expert Stylists" },
    ],
    marquee: [
      "Haircuts",
      "Colour & Balayage",
      "Bridal Styling",
      "Spa Treatments",
      "Skin Facials",
      "Nail Care",
    ].map((label, i) => ({ id: `hero-marquee-${i + 1}`, label })),
  },
};

const EXPERIENCE_SECTION: Section = {
  id: "sec-experience",
  type: "EXPERIENCE",
  label: "",
  enabled: true,
  data: {
    eyebrow: "Our Story",
    titleLead: "More Than a Salon, An",
    titleAccent: "Experience",
    paragraph:
      // The source JSX writes `it&apos;s`, which renders as a plain ASCII
      // apostrophe — transcribed literally so the published text is identical.
      "At Renzo, we believe beauty is more than just a look — it's a feeling. Our mission is to create a space where every visit leaves you more confident than the last.",
    cta: { label: "Read More", href: "/#about" },
    blurb: STATS_BLURB,
    stats: STATS.map((s, i) => ({
      id: `exp-stat-${i + 1}`,
      value: s.value,
      suffix: s.suffix,
      label: s.label,
    })),
  },
};

const SERVICES_SECTION: Section = {
  id: "sec-services",
  type: "SERVICES",
  label: "",
  enabled: true,
  data: {
    eyebrow: "What we do",
    title: "Our Signature Services",
    subtitle:
      "From everyday grooming to special-occasion glam, our menu covers every look.",
    ctaLabel: "Book Now",
    ctaHref: "/services",
    items: SERVICES.map((s, i) => ({
      id: `service-${i + 1}`,
      name: s.name,
      desc: s.desc,
      image: { url: s.img, alt: s.name },
      featured: Boolean(s.featured),
      hidden: false,
    })),
  },
};

const BENEFITS_SECTION: Section = {
  id: "sec-benefits",
  type: "BENEFITS",
  label: "",
  enabled: true,
  data: {
    eyebrow: "Why Choose Us",
    titleLead: "Because You",
    titleAccent: "Deserve The Best",
    paragraph:
      "Experience premium salon services delivered by expert stylists using world-class products in a luxurious and relaxing environment.",
    items: BENEFITS.map((b, i) => ({
      id: `benefit-${i + 1}`,
      icon: BENEFIT_ICONS[i] ?? "Sparkles",
      title: b.title,
      desc: b.desc,
      hidden: false,
    })),
  },
};

const GALLERY_SECTION: Section = {
  id: "sec-gallery",
  type: "GALLERY",
  label: "",
  enabled: true,
  data: {
    title: "Our Work Speaks for Itself",
    paragraph:
      "Step inside Renzo through our gallery. From chic hairstyles to flawless makeovers, every look is a reflection of our passion for beauty.",
    cta: { label: "View All", href: "/gallery" },
    images: GALLERY.map((g, i) => ({
      id: `gallery-${i + 1}`,
      url: g.src,
      alt: g.alt,
      hidden: false,
    })),
  },
};

const PRICING_SECTION: Section = {
  id: "sec-pricing",
  type: "PRICING",
  label: "",
  enabled: true,
  data: {
    eyebrow: "Membership",
    title: "Luxury Made Affordable",
    paragraph:
      "Join a Renzo membership and enjoy your favourite services for less — with priority booking and members-only perks.",
    ctaLabel: "Get Started",
    ctaHref: "/packages",
    tiers: PRICING_TIERS.map((t, i) => ({
      id: `tier-${i + 1}`,
      // Every tier renders the same Sparkles mark today.
      icon: "Sparkles" as IconName,
      name: t.name,
      monthly: t.monthly,
      featured: Boolean(t.featured),
      hidden: false,
      items: t.items.map((item, j) => ({
        id: `tier-${i + 1}-item-${j + 1}`,
        label: item.label,
        price: item.price,
      })),
    })),
  },
};

const BLOG_SECTION: Section = {
  id: "sec-blog",
  type: "BLOG",
  label: "",
  enabled: true,
  data: {
    eyebrow: "Journal",
    titleLead: "Our Latest",
    titleAccent: "Stories",
    paragraph:
      "Tips, trends and rituals from our stylists — everything you need to look and feel your best between visits.",
    cta: { label: "View All", href: "/blog" },
    readLabel: "Read Article",
    ticker: ["Hair Care", "Skin Rituals", "Colour Trends", "Bridal Prep", "Styling Tips"].map(
      (label, i) => ({ id: `blog-ticker-${i + 1}`, label })
    ),
    posts: BLOG_POSTS.map((p, i) => ({
      id: `post-${i + 1}`,
      image: { url: p.img, alt: p.title },
      tag: p.tag,
      date: p.date,
      title: p.title,
      href: "/blog",
      hidden: false,
    })),
  },
};

const TESTIMONIALS_SECTION: Section = {
  id: "sec-testimonials",
  type: "TESTIMONIALS",
  label: "",
  enabled: true,
  data: {
    eyebrow: "Kind words",
    title: "Hear from the Renzo Family",
    items: TESTIMONIALS.map((t, i) => ({
      id: `testimonial-${i + 1}`,
      name: t.name,
      role: t.role,
      text: t.text,
      rating: t.rating,
      hidden: false,
    })),
  },
};

/**
 * FAQs are NOT on the homepage today, so this section ships DISABLED. The copy is
 * already written (it lives in home-data), and a Super Admin can switch it on and
 * publish — but until they do, the page is unchanged.
 */
const FAQ_SECTION: Section = {
  id: "sec-faq",
  type: "FAQ",
  label: "",
  enabled: false,
  data: {
    eyebrow: "Good to know",
    title: "Frequently Asked Questions",
    subtitle: "Everything you might want to check before your first visit.",
    items: FAQS.map((f, i) => ({
      id: `faq-${i + 1}`,
      question: f.q,
      answer: f.a,
      hidden: false,
    })),
  },
};

const CONTACT_SECTION: Section = {
  id: "sec-contact",
  type: "CONTACT",
  label: "",
  enabled: true,
  data: {
    title: "Renzo",
    tagline: CONTACT_INFO.tagline,
    address: CONTACT_INFO.address,
    phone: CONTACT_INFO.phone,
    email: CONTACT_INFO.email,
    backgroundImage: { url: CONTACT_IMAGE, alt: "" },
    formTitle: "Booking enquiry",
    nameLabel: "Name",
    namePlaceholder: "Full name",
    phoneLabel: "Phone",
    phonePlaceholder: "Phone number",
    emailLabel: "Email",
    emailPlaceholder: "you@email.com",
    cta: { label: "Book Now", href: "/book" },
  },
};

/**
 * Section ORDER here is the order the homepage renders today:
 * Hero → Experience → Services → Benefits → Gallery → Pricing → Blog →
 * Testimonials → Contact. FAQ sits before Contact but starts disabled.
 */
export const DEFAULT_HOME_CONTENT: HomeContent = {
  schemaVersion: 1,
  sections: [
    HERO_SECTION,
    EXPERIENCE_SECTION,
    SERVICES_SECTION,
    BENEFITS_SECTION,
    GALLERY_SECTION,
    PRICING_SECTION,
    BLOG_SECTION,
    TESTIMONIALS_SECTION,
    FAQ_SECTION,
    CONTACT_SECTION,
  ],
  branding: {
    siteName: "Renzo",
    // Empty means "use the built-in scissors mark" — the header/footer never blank.
    logoImage: { url: "", alt: "" },
    footerLogoImage: { url: "", alt: "" },
    faviconUrl: "",
    watermarkImage: { url: "", alt: "" },
  },
  footer: {
    tagline: "A modern hair & beauty studio crafting confidence, one cut at a time.",
    columns: [
      {
        id: "footer-col-explore",
        title: "Explore",
        links: [
          { id: "fl-services", label: "Services", href: "/services" },
          { id: "fl-stylists", label: "Stylists", href: "/stylists" },
          { id: "fl-packages", label: "Packages", href: "/packages" },
          { id: "fl-gallery", label: "Gallery", href: "/gallery" },
          { id: "fl-offers", label: "Offers", href: "/offers" },
        ],
      },
      {
        id: "footer-col-company",
        title: "Company",
        links: [
          { id: "fl-about", label: "About Us", href: "/#about" },
          { id: "fl-branches", label: "Branches", href: "/branches" },
          { id: "fl-blog", label: "Blog", href: "/blog" },
          { id: "fl-contact", label: "Contact", href: "/contact" },
          { id: "fl-book", label: "Book Now", href: "/book" },
        ],
      },
    ],
    contactTitle: "Visit Us",
    address: CONTACT_INFO.address,
    phone: "+91 9591969838",
    email: "hello@renzo.salon",
    socials: [
      { id: "social-ig", icon: "Instagram", label: "Instagram", href: "#" },
      { id: "social-wa", icon: "WhatsApp", label: "WhatsApp", href: "#" },
      { id: "social-fb", icon: "Facebook", label: "Facebook", href: "#" },
    ],
    // Rendered as "© {current year} {copyright}" — the year stays live, never authored.
    copyright: "Renzo Salon. All rights reserved.",
    legalLinks: [
      { id: "legal-privacy", label: "Privacy Policy", href: "#" },
      { id: "legal-terms", label: "Terms of Service", href: "#" },
    ],
  },
};

/** A deep copy, so a caller can mutate a draft without touching the shared default. */
export function cloneDefaultContent(): HomeContent {
  return structuredClone(DEFAULT_HOME_CONTENT);
}

/**
 * Company/contact address only — never branch street addresses.
 * Published CMS rows can still hold a retired Mumbai or Chikka Bommasandra
 * string; those are rewritten to CONTACT_INFO.address on read.
 */
const STALE_COMPANY_ADDRESS = /rosewood|bandra west|mumbai\s*400050|chikka bommasandra/i;

export function normalizeCompanyAddress(content: HomeContent): HomeContent {
  const next = structuredClone(content);
  if (STALE_COMPANY_ADDRESS.test(next.footer.address)) {
    next.footer.address = CONTACT_INFO.address;
  }
  for (const section of next.sections) {
    if (section.type !== "CONTACT") continue;
    const address = (section.data as { address?: string }).address;
    if (typeof address === "string" && STALE_COMPANY_ADDRESS.test(address)) {
      (section.data as { address: string }).address = CONTACT_INFO.address;
    }
  }
  return next;
}

/**
 * A fresh section of the given type, seeded from the default content and given
 * new ids so it can coexist with the section it was copied from.
 *
 * Seeding from the defaults rather than from blank fields means an added section
 * renders something sensible immediately — an author edits real copy instead of
 * staring at an empty form and a collapsed layout in the preview.
 */
export function createSection(type: SectionType, idSuffix: string): Section {
  const template = DEFAULT_HOME_CONTENT.sections.find((section) => section.type === type);
  if (!template) throw new Error(`No default template for section type ${type}`);

  const copy = structuredClone(template);
  copy.id = `sec-${type.toLowerCase()}-${idSuffix}`;
  copy.enabled = true;

  // Re-key every nested collection item; duplicate React keys across two sections
  // of the same type would otherwise collide.
  reindexItems(copy, idSuffix);
  return copy;
}

/** Rewrites every `id` inside a section's data so the copy owns unique keys. */
function reindexItems(section: Section, suffix: string): void {
  const seen = new Map<string, number>();

  const rekey = (value: unknown): void => {
    if (Array.isArray(value)) {
      value.forEach(rekey);
      return;
    }
    if (!value || typeof value !== "object") return;

    const record = value as Record<string, unknown>;
    if (typeof record.id === "string") {
      const base = record.id;
      const n = (seen.get(base) ?? 0) + 1;
      seen.set(base, n);
      record.id = `${base}-${suffix}${n > 1 ? `-${n}` : ""}`;
    }
    Object.values(record).forEach(rekey);
  };

  rekey(section.data);
}
