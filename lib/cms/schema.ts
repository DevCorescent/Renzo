// ============================================================================
// OWNER  : Gauransh
// MODULE : Homepage CMS — content contract
//
// PURPOSE
// One authoritative, versionable description of every piece of *content* the
// public homepage renders. Content only: no font, size, weight, colour, spacing,
// layout or breakpoint is expressible here by design — those stay in the section
// components and cannot be reached from the CMS.
//
// SHAPE
// `HomeContent` is an ORDERED array of sections plus site-wide branding/footer
// content. The section count is NOT fixed: sections can be added, removed,
// reordered, enabled and disabled. Each section carries a `type` that maps to an
// existing homepage component (see components/public/home/home-sections.tsx) —
// so new sections reuse layouts that already exist rather than inventing new ones.
//
// VALIDATION
// Every write goes through `HomeContentSchema`, and every read from the database
// is re-parsed through it, so a hand-edited or older row can never crash a render.
// ============================================================================

import { z } from "zod";

/* ─── Primitives ───────────────────────────────────────────────────────────── */

/** Stable per-item key. Used for React keys and for reorder/delete targeting. */
const ItemId = z.string().min(1).max(64);

/** Free text. Trimmed of nothing — an author may legitimately want a trailing space. */
const Text = z.string().max(4000);

const ShortText = z.string().max(300);

/**
 * An image reference. `url` is whatever the existing uploader returned (an R2
 * public URL) or an external https URL that was already in use. `alt` is content,
 * so it is editable; empty alt is valid for purely decorative images.
 */
export const ImageRefSchema = z.object({
  url: z.string().max(2000),
  alt: ShortText.default(""),
});

/** A label + destination pair. Both are content; neither affects styling. */
export const LinkSchema = z.object({
  label: ShortText,
  href: ShortText,
});

/**
 * Icons are picked from a fixed whitelist, never free-typed — an arbitrary string
 * would let an author break a render. The whitelist maps to real lucide icons in
 * lib/cms/icons.ts.
 */
export const ICON_NAMES = [
  "Scissors",
  "Droplets",
  "Flower2",
  "Brush",
  "Wand2",
  "Sparkles",
  "Gem",
  "Star",
  "Heart",
  "Crown",
  "Leaf",
  "Sun",
] as const;

export const IconNameSchema = z.enum(ICON_NAMES);
export type IconName = (typeof ICON_NAMES)[number];

/* ─── Section payloads ─────────────────────────────────────────────────────── */

export const HeroDataSchema = z.object({
  eyebrow: ShortText,
  /** The headline is three authored fragments; the component decides how each is typeset. */
  titleLead: ShortText,
  titleMiddle: ShortText,
  titleAccent: ShortText,
  paragraph: Text,
  primaryCta: LinkSchema,
  secondaryCta: LinkSchema,
  /**
   * The rating shown beside the avatar row. Authored rather than derived so an
   * edit to the testimonials list can never silently move a number the salon
   * advertises publicly.
   */
  ratingValue: ShortText,
  trustLine: ShortText,
  scrollLabel: ShortText,
  watermarkText: ShortText,
  backgroundImage: ImageRefSchema,
  avatars: z.array(ImageRefSchema.extend({ id: ItemId })).max(12),
  stats: z.array(z.object({ id: ItemId, value: ShortText, label: ShortText })).max(12),
  marquee: z.array(z.object({ id: ItemId, label: ShortText })).max(24),
});

export const ExperienceDataSchema = z.object({
  eyebrow: ShortText,
  titleLead: ShortText,
  titleAccent: ShortText,
  paragraph: Text,
  cta: LinkSchema,
  blurb: Text,
  /** Count-up statistics. `value` is numeric because the counter animates to it. */
  stats: z
    .array(
      z.object({
        id: ItemId,
        value: z.number().int().min(0).max(1_000_000),
        suffix: ShortText,
        label: ShortText,
      })
    )
    .max(12),
});

export const ServicesDataSchema = z.object({
  eyebrow: ShortText,
  title: ShortText,
  subtitle: Text,
  ctaLabel: ShortText,
  ctaHref: ShortText,
  items: z
    .array(
      z.object({
        id: ItemId,
        name: ShortText,
        desc: Text,
        image: ImageRefSchema,
        featured: z.boolean().default(false),
        hidden: z.boolean().default(false),
      })
    )
    .max(30),
});

export const BenefitsDataSchema = z.object({
  eyebrow: ShortText,
  titleLead: ShortText,
  titleAccent: ShortText,
  paragraph: Text,
  items: z
    .array(
      z.object({
        id: ItemId,
        icon: IconNameSchema,
        title: ShortText,
        desc: Text,
        hidden: z.boolean().default(false),
      })
    )
    .max(24),
});

export const GalleryDataSchema = z.object({
  title: ShortText,
  paragraph: Text,
  cta: LinkSchema,
  images: z.array(ImageRefSchema.extend({ id: ItemId, hidden: z.boolean().default(false) })).max(24),
});

export const PricingDataSchema = z.object({
  eyebrow: ShortText,
  title: ShortText,
  paragraph: Text,
  ctaLabel: ShortText,
  ctaHref: ShortText,
  tiers: z
    .array(
      z.object({
        id: ItemId,
        icon: IconNameSchema,
        name: ShortText,
        monthly: ShortText,
        featured: z.boolean().default(false),
        hidden: z.boolean().default(false),
        items: z.array(z.object({ id: ItemId, label: ShortText, price: ShortText })).max(20),
      })
    )
    .max(12),
});

export const BlogDataSchema = z.object({
  eyebrow: ShortText,
  titleLead: ShortText,
  titleAccent: ShortText,
  paragraph: Text,
  cta: LinkSchema,
  readLabel: ShortText,
  ticker: z.array(z.object({ id: ItemId, label: ShortText })).max(24),
  posts: z
    .array(
      z.object({
        id: ItemId,
        image: ImageRefSchema,
        tag: ShortText,
        date: ShortText,
        title: ShortText,
        href: ShortText,
        hidden: z.boolean().default(false),
      })
    )
    .max(24),
});

export const TestimonialsDataSchema = z.object({
  eyebrow: ShortText,
  title: ShortText,
  items: z
    .array(
      z.object({
        id: ItemId,
        name: ShortText,
        role: ShortText,
        text: Text,
        rating: z.number().min(0).max(5),
        hidden: z.boolean().default(false),
      })
    )
    .max(40),
});

export const FaqDataSchema = z.object({
  eyebrow: ShortText,
  title: ShortText,
  subtitle: Text,
  items: z
    .array(
      z.object({
        id: ItemId,
        question: ShortText,
        answer: Text,
        hidden: z.boolean().default(false),
      })
    )
    .max(40),
});

export const ContactDataSchema = z.object({
  title: ShortText,
  tagline: Text,
  address: ShortText,
  phone: ShortText,
  email: ShortText,
  backgroundImage: ImageRefSchema,
  formTitle: ShortText,
  nameLabel: ShortText,
  namePlaceholder: ShortText,
  phoneLabel: ShortText,
  phonePlaceholder: ShortText,
  emailLabel: ShortText,
  emailPlaceholder: ShortText,
  cta: LinkSchema,
});

/* ─── Section envelope ─────────────────────────────────────────────────────── */

/**
 * Every section type maps 1:1 to a component that already exists on the homepage.
 * Adding a type here without adding a renderer is a compile error in
 * home-sections.tsx (the map is exhaustively typed), so the two cannot drift.
 */
export const SECTION_TYPES = [
  "HERO",
  "EXPERIENCE",
  "SERVICES",
  "BENEFITS",
  "GALLERY",
  "PRICING",
  "BLOG",
  "TESTIMONIALS",
  "FAQ",
  "CONTACT",
] as const;

export type SectionType = (typeof SECTION_TYPES)[number];

/** Human labels for the editor. Not rendered on the public site. */
export const SECTION_LABELS: Record<SectionType, string> = {
  HERO: "Hero",
  EXPERIENCE: "About / Experience",
  SERVICES: "Feature — Services",
  BENEFITS: "Why Choose Us",
  GALLERY: "Gallery",
  PRICING: "Pricing / Membership",
  BLOG: "Journal",
  TESTIMONIALS: "Testimonials",
  FAQ: "FAQs",
  CONTACT: "Contact",
};

/**
 * Types that may appear at most once. Hero and Contact are anchored page
 * furniture; the rest are ordinary content blocks that may legitimately repeat
 * (e.g. two feature strips separated by a gallery).
 */
export const SINGLETON_SECTIONS: readonly SectionType[] = ["HERO", "CONTACT"];

const sectionBase = {
  id: ItemId,
  /** Optional author-facing name so two SERVICES blocks are distinguishable. */
  label: ShortText.default(""),
  enabled: z.boolean(),
};

export const SectionSchema = z.discriminatedUnion("type", [
  z.object({ ...sectionBase, type: z.literal("HERO"), data: HeroDataSchema }),
  z.object({ ...sectionBase, type: z.literal("EXPERIENCE"), data: ExperienceDataSchema }),
  z.object({ ...sectionBase, type: z.literal("SERVICES"), data: ServicesDataSchema }),
  z.object({ ...sectionBase, type: z.literal("BENEFITS"), data: BenefitsDataSchema }),
  z.object({ ...sectionBase, type: z.literal("GALLERY"), data: GalleryDataSchema }),
  z.object({ ...sectionBase, type: z.literal("PRICING"), data: PricingDataSchema }),
  z.object({ ...sectionBase, type: z.literal("BLOG"), data: BlogDataSchema }),
  z.object({ ...sectionBase, type: z.literal("TESTIMONIALS"), data: TestimonialsDataSchema }),
  z.object({ ...sectionBase, type: z.literal("FAQ"), data: FaqDataSchema }),
  z.object({ ...sectionBase, type: z.literal("CONTACT"), data: ContactDataSchema }),
]);

/* ─── Site-wide content (header, footer, branding) ─────────────────────────── */

/**
 * Branding assets. `logoImage.url` empty means "keep the built-in mark" — the
 * header/footer fall back to the existing icon, so an empty CMS never blanks the
 * brand.
 */
export const BrandingSchema = z.object({
  siteName: ShortText,
  logoImage: ImageRefSchema,
  footerLogoImage: ImageRefSchema,
  faviconUrl: z.string().max(2000).default(""),
  /**
   * The oversized brand mark behind the hero. Empty url keeps the existing TEXT
   * watermark (hero.watermarkText); setting one swaps in the image at the same
   * position. Lives in branding rather than the hero because it is brand
   * furniture, and is forwarded to the hero by the section renderer.
   */
  watermarkImage: ImageRefSchema,
});

/** Social marks the footer can render. Whitelisted for the same reason as icons. */
export const SOCIAL_ICON_NAMES = ["Instagram", "WhatsApp", "Facebook", "YouTube", "Twitter"] as const;
export type SocialIconName = (typeof SOCIAL_ICON_NAMES)[number];

export const FooterSchema = z.object({
  tagline: Text,
  columns: z
    .array(
      z.object({
        id: ItemId,
        title: ShortText,
        links: z.array(LinkSchema.extend({ id: ItemId })).max(20),
      })
    )
    .max(6),
  contactTitle: ShortText,
  address: ShortText,
  phone: ShortText,
  email: ShortText,
  socials: z
    .array(z.object({ id: ItemId, icon: z.enum(SOCIAL_ICON_NAMES), label: ShortText, href: ShortText }))
    .max(10),
  copyright: ShortText,
  legalLinks: z.array(LinkSchema.extend({ id: ItemId })).max(8),
});

/* ─── Document ─────────────────────────────────────────────────────────────── */

export const HomeContentSchema = z.object({
  /** Bumped only when the shape changes in a way a migration must notice. */
  schemaVersion: z.literal(1).default(1),
  sections: z.array(SectionSchema).max(40),
  branding: BrandingSchema,
  footer: FooterSchema,
});

export type ImageRef = z.infer<typeof ImageRefSchema>;
export type LinkItem = z.infer<typeof LinkSchema>;
export type HeroData = z.infer<typeof HeroDataSchema>;
export type ExperienceData = z.infer<typeof ExperienceDataSchema>;
export type ServicesData = z.infer<typeof ServicesDataSchema>;
export type BenefitsData = z.infer<typeof BenefitsDataSchema>;
export type GalleryData = z.infer<typeof GalleryDataSchema>;
export type PricingData = z.infer<typeof PricingDataSchema>;
export type BlogData = z.infer<typeof BlogDataSchema>;
export type TestimonialsData = z.infer<typeof TestimonialsDataSchema>;
export type FaqData = z.infer<typeof FaqDataSchema>;
export type ContactData = z.infer<typeof ContactDataSchema>;
export type Branding = z.infer<typeof BrandingSchema>;
export type FooterContent = z.infer<typeof FooterSchema>;
export type Section = z.infer<typeof SectionSchema>;
export type HomeContent = z.infer<typeof HomeContentSchema>;

/** Narrow a section to one type — used by the renderer and the editor forms. */
export type SectionOf<T extends SectionType> = Extract<Section, { type: T }>;

/* ─── Media library ────────────────────────────────────────────────────────── */

/**
 * The media library is an index over images already uploaded through the existing
 * /api/v1/upload route. It stores no bytes — only the returned URL plus the
 * authoring metadata the CMS needs (which section it belongs to, alt text, and a
 * soft-delete flag so a removed image can be restored).
 */
export const MediaItemSchema = z.object({
  id: ItemId,
  url: z.string().max(2000),
  name: ShortText,
  alt: ShortText.default(""),
  /** Free-form grouping, e.g. "Hero", "Gallery", "Branding". */
  category: ShortText.default("General"),
  uploadedAt: z.string(),
  uploadedBy: ShortText.default(""),
  deleted: z.boolean().default(false),
});

export const MediaLibrarySchema = z.object({
  items: z.array(MediaItemSchema).max(2000),
});

export type MediaItem = z.infer<typeof MediaItemSchema>;
export type MediaLibrary = z.infer<typeof MediaLibrarySchema>;

/* ─── Publishing envelopes ─────────────────────────────────────────────────── */

export const DraftEnvelopeSchema = z.object({
  content: HomeContentSchema,
  updatedAt: z.string(),
  updatedBy: ShortText.default(""),
});

export const PublishedEnvelopeSchema = z.object({
  version: z.number().int().min(1),
  content: HomeContentSchema,
  publishedAt: z.string(),
  publishedById: ShortText.default(""),
  publishedBy: ShortText.default(""),
  summary: ShortText.default(""),
});

export type DraftEnvelope = z.infer<typeof DraftEnvelopeSchema>;
export type PublishedEnvelope = z.infer<typeof PublishedEnvelopeSchema>;
