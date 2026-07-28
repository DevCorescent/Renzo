"use client";

// ============================================================================
// OWNER  : Gauransh
// MODULE : Homepage CMS — per-section forms
//
// One form per section type. Each receives the section's typed `data` and emits
// the next `data`; none of them knows how content is persisted, which keeps the
// editor shell free of section-specific logic.
//
// The switch in <SectionForm> is exhaustive over SectionType. Adding a section
// type to the schema without adding a form here is a TypeScript error, so the
// editor can never silently fail to expose a section's content.
// ============================================================================

import type {
  BenefitsData,
  BlogData,
  ContactData,
  ExperienceData,
  FaqData,
  GalleryData,
  MediaItem,
  PricingData,
  Section,
  ServicesData,
  TestimonialsData,
  HeroData,
} from "@/lib/cms/schema";

import {
  IconField,
  ImageField,
  LinkField,
  NumberField,
  RepeatableList,
  TextAreaField,
  TextField,
  newItemId,
} from "./fields";

/** Everything a form needs to offer image upload + library reuse. */
export type MediaBridge = {
  library: MediaItem[];
  onIndexed: (url: string, category: string) => void;
};

type FormProps<T> = { data: T; onChange: (data: T) => void; media: MediaBridge };

const GRID = "grid gap-4 sm:grid-cols-2";

/* ─── Hero ─────────────────────────────────────────────────────────────────── */

function HeroForm({ data, onChange, media }: FormProps<HeroData>) {
  const set = <K extends keyof HeroData>(key: K, value: HeroData[K]) =>
    onChange({ ...data, [key]: value });

  return (
    <div className="space-y-4">
      <div className={GRID}>
        <TextField label="Eyebrow" value={data.eyebrow} onChange={(v) => set("eyebrow", v)} />
        <TextField label="Watermark text" value={data.watermarkText} onChange={(v) => set("watermarkText", v)} hint="Shown only when no watermark image is set in Branding." />
        <TextField label="Headline — first line" value={data.titleLead} onChange={(v) => set("titleLead", v)} />
        <TextField label="Headline — second line" value={data.titleMiddle} onChange={(v) => set("titleMiddle", v)} />
        <TextField label="Headline — highlighted word" value={data.titleAccent} onChange={(v) => set("titleAccent", v)} />
        <TextField label="Scroll cue label" value={data.scrollLabel} onChange={(v) => set("scrollLabel", v)} />
      </div>

      <TextAreaField label="Paragraph" value={data.paragraph} onChange={(v) => set("paragraph", v)} rows={3} />

      <LinkField label="Primary button" value={data.primaryCta} onChange={(v) => set("primaryCta", v)} />
      <LinkField label="Secondary button" value={data.secondaryCta} onChange={(v) => set("secondaryCta", v)} />

      <div className={GRID}>
        <TextField label="Rating shown beside the faces" value={data.ratingValue} onChange={(v) => set("ratingValue", v)} />
        <TextField label="Trust line" value={data.trustLine} onChange={(v) => set("trustLine", v)} />
      </div>

      <ImageField
        label="Background image"
        value={data.backgroundImage}
        onChange={(v) => set("backgroundImage", v)}
        library={media.library}
        onIndexed={media.onIndexed}
        category="Hero"
      />

      <RepeatableList
        title="Statistics"
        items={data.stats}
        onChange={(stats) => set("stats", stats)}
        createItem={() => ({ id: newItemId("hero-stat"), value: "", label: "" })}
        itemLabel={(item) => `${item.value} ${item.label}`.trim()}
        renderItem={(item, update) => (
          <div className={GRID}>
            <TextField label="Value" value={item.value} onChange={(v) => update({ value: v })} />
            <TextField label="Label" value={item.label} onChange={(v) => update({ label: v })} />
          </div>
        )}
      />

      <RepeatableList
        title="Scrolling strip"
        items={data.marquee}
        onChange={(marquee) => set("marquee", marquee)}
        createItem={() => ({ id: newItemId("hero-marquee"), label: "" })}
        itemLabel={(item) => item.label}
        renderItem={(item, update) => (
          <TextField label="Text" value={item.label} onChange={(v) => update({ label: v })} />
        )}
      />

      <RepeatableList
        title="Faces in the trust row"
        items={data.avatars}
        onChange={(avatars) => set("avatars", avatars)}
        createItem={() => ({ id: newItemId("hero-avatar"), url: "", alt: "" })}
        itemLabel={(item, i) => item.alt || `Face ${i + 1}`}
        renderItem={(item, update) => (
          <ImageField
            label="Photo"
            value={{ url: item.url, alt: item.alt }}
            onChange={(v) => update({ url: v.url, alt: v.alt })}
            library={media.library}
            onIndexed={media.onIndexed}
            category="Hero"
          />
        )}
      />
    </div>
  );
}

/* ─── Experience / About ───────────────────────────────────────────────────── */

function ExperienceForm({ data, onChange }: FormProps<ExperienceData>) {
  const set = <K extends keyof ExperienceData>(key: K, value: ExperienceData[K]) =>
    onChange({ ...data, [key]: value });

  return (
    <div className="space-y-4">
      <div className={GRID}>
        <TextField label="Eyebrow" value={data.eyebrow} onChange={(v) => set("eyebrow", v)} />
        <TextField label="Heading" value={data.titleLead} onChange={(v) => set("titleLead", v)} />
        <TextField label="Highlighted word" value={data.titleAccent} onChange={(v) => set("titleAccent", v)} />
      </div>
      <TextAreaField label="Paragraph" value={data.paragraph} onChange={(v) => set("paragraph", v)} />
      <TextAreaField label="Line above the statistics" value={data.blurb} onChange={(v) => set("blurb", v)} rows={2} />
      <LinkField label="Button" value={data.cta} onChange={(v) => set("cta", v)} />

      <RepeatableList
        title="Statistics"
        items={data.stats}
        onChange={(stats) => set("stats", stats)}
        createItem={() => ({ id: newItemId("exp-stat"), value: 0, suffix: "", label: "" })}
        itemLabel={(item) => `${item.value}${item.suffix} ${item.label}`.trim()}
        renderItem={(item, update) => (
          <div className="grid gap-4 sm:grid-cols-3">
            <NumberField label="Number (counts up)" value={item.value} onChange={(v) => update({ value: v })} />
            <TextField label="Suffix" value={item.suffix} onChange={(v) => update({ suffix: v })} />
            <TextField label="Label" value={item.label} onChange={(v) => update({ label: v })} />
          </div>
        )}
      />
    </div>
  );
}

/* ─── Services ─────────────────────────────────────────────────────────────── */

function ServicesForm({ data, onChange, media }: FormProps<ServicesData>) {
  const set = <K extends keyof ServicesData>(key: K, value: ServicesData[K]) =>
    onChange({ ...data, [key]: value });

  return (
    <div className="space-y-4">
      <div className={GRID}>
        <TextField label="Eyebrow" value={data.eyebrow} onChange={(v) => set("eyebrow", v)} />
        <TextField label="Title" value={data.title} onChange={(v) => set("title", v)} />
      </div>
      <TextAreaField label="Subtitle" value={data.subtitle} onChange={(v) => set("subtitle", v)} rows={2} />
      <div className={GRID}>
        <TextField label="Card button text" value={data.ctaLabel} onChange={(v) => set("ctaLabel", v)} />
        <TextField label="Card button link" value={data.ctaHref} onChange={(v) => set("ctaHref", v)} />
      </div>

      <RepeatableList
        title="Cards"
        items={data.items}
        onChange={(items) => set("items", items)}
        createItem={() => ({
          id: newItemId("service"),
          name: "",
          desc: "",
          image: { url: "", alt: "" },
          featured: false,
          hidden: false,
        })}
        itemLabel={(item) => item.name}
        isHidden={(item) => item.hidden}
        onToggleHidden={(item) => ({ ...item, hidden: !item.hidden })}
        renderItem={(item, update) => (
          <div className="space-y-3">
            <TextField label="Name" value={item.name} onChange={(v) => update({ name: v })} />
            <TextAreaField label="Description" value={item.desc} onChange={(v) => update({ desc: v })} rows={2} />
            <ImageField
              label="Image"
              value={item.image}
              onChange={(v) => update({ image: v })}
              library={media.library}
              onIndexed={media.onIndexed}
              category="Services"
            />
            <label className="flex items-center gap-2 text-xs text-gray-700 dark:text-(--sa-text)">
              <input
                type="checkbox"
                checked={item.featured}
                onChange={(e) => update({ featured: e.target.checked })}
                className="size-4 rounded border-gray-300"
              />
              Feature this card (renders wider, with its description always visible)
            </label>
          </div>
        )}
      />
    </div>
  );
}

/* ─── Benefits ─────────────────────────────────────────────────────────────── */

function BenefitsForm({ data, onChange }: FormProps<BenefitsData>) {
  const set = <K extends keyof BenefitsData>(key: K, value: BenefitsData[K]) =>
    onChange({ ...data, [key]: value });

  return (
    <div className="space-y-4">
      <div className={GRID}>
        <TextField label="Eyebrow" value={data.eyebrow} onChange={(v) => set("eyebrow", v)} />
        <TextField label="Heading" value={data.titleLead} onChange={(v) => set("titleLead", v)} />
        <TextField label="Highlighted words" value={data.titleAccent} onChange={(v) => set("titleAccent", v)} />
      </div>
      <TextAreaField label="Paragraph" value={data.paragraph} onChange={(v) => set("paragraph", v)} />

      <RepeatableList
        title="Cards"
        items={data.items}
        onChange={(items) => set("items", items)}
        createItem={() => ({ id: newItemId("benefit"), icon: "Sparkles" as const, title: "", desc: "", hidden: false })}
        itemLabel={(item) => item.title}
        isHidden={(item) => item.hidden}
        onToggleHidden={(item) => ({ ...item, hidden: !item.hidden })}
        renderItem={(item, update) => (
          <div className="space-y-3">
            <div className={GRID}>
              <TextField label="Title" value={item.title} onChange={(v) => update({ title: v })} />
              <IconField label="Icon" value={item.icon} onChange={(v) => update({ icon: v })} />
            </div>
            <TextAreaField label="Description" value={item.desc} onChange={(v) => update({ desc: v })} rows={2} />
          </div>
        )}
      />
    </div>
  );
}

/* ─── Gallery ──────────────────────────────────────────────────────────────── */

function GalleryForm({ data, onChange, media }: FormProps<GalleryData>) {
  const set = <K extends keyof GalleryData>(key: K, value: GalleryData[K]) =>
    onChange({ ...data, [key]: value });

  return (
    <div className="space-y-4">
      <TextField label="Title" value={data.title} onChange={(v) => set("title", v)} />
      <TextAreaField label="Paragraph" value={data.paragraph} onChange={(v) => set("paragraph", v)} />
      <LinkField label="Button" value={data.cta} onChange={(v) => set("cta", v)} />

      <RepeatableList
        title="Images"
        items={data.images}
        onChange={(images) => set("images", images)}
        createItem={() => ({ id: newItemId("gallery"), url: "", alt: "", hidden: false })}
        itemLabel={(item, i) => item.alt || `Image ${i + 1}`}
        isHidden={(item) => item.hidden}
        onToggleHidden={(item) => ({ ...item, hidden: !item.hidden })}
        renderItem={(item, update) => (
          <ImageField
            label="Image"
            value={{ url: item.url, alt: item.alt }}
            onChange={(v) => update({ url: v.url, alt: v.alt })}
            library={media.library}
            onIndexed={media.onIndexed}
            category="Gallery"
          />
        )}
      />
    </div>
  );
}

/* ─── Pricing ──────────────────────────────────────────────────────────────── */

function PricingForm({ data, onChange }: FormProps<PricingData>) {
  const set = <K extends keyof PricingData>(key: K, value: PricingData[K]) =>
    onChange({ ...data, [key]: value });

  return (
    <div className="space-y-4">
      <div className={GRID}>
        <TextField label="Eyebrow" value={data.eyebrow} onChange={(v) => set("eyebrow", v)} />
        <TextField label="Title" value={data.title} onChange={(v) => set("title", v)} />
      </div>
      <TextAreaField label="Paragraph" value={data.paragraph} onChange={(v) => set("paragraph", v)} />
      <div className={GRID}>
        <TextField label="Tier button text" value={data.ctaLabel} onChange={(v) => set("ctaLabel", v)} />
        <TextField label="Tier button link" value={data.ctaHref} onChange={(v) => set("ctaHref", v)} />
      </div>

      <RepeatableList
        title="Tiers"
        items={data.tiers}
        onChange={(tiers) => set("tiers", tiers)}
        createItem={() => ({
          id: newItemId("tier"),
          icon: "Sparkles" as const,
          name: "",
          monthly: "",
          featured: false,
          hidden: false,
          items: [],
        })}
        itemLabel={(item) => item.name}
        isHidden={(item) => item.hidden}
        onToggleHidden={(item) => ({ ...item, hidden: !item.hidden })}
        renderItem={(tier, update) => (
          <div className="space-y-3">
            <div className="grid gap-4 sm:grid-cols-3">
              <TextField label="Name" value={tier.name} onChange={(v) => update({ name: v })} />
              <TextField label="Monthly price" value={tier.monthly} onChange={(v) => update({ monthly: v })} />
              <IconField label="Icon" value={tier.icon} onChange={(v) => update({ icon: v })} />
            </div>
            <label className="flex items-center gap-2 text-xs text-gray-700 dark:text-(--sa-text)">
              <input
                type="checkbox"
                checked={tier.featured}
                onChange={(e) => update({ featured: e.target.checked })}
                className="size-4 rounded border-gray-300"
              />
              Highlight this tier
            </label>
            <RepeatableList
              title="Lines"
              items={tier.items}
              onChange={(items) => update({ items })}
              createItem={() => ({ id: newItemId("tier-line"), label: "", price: "" })}
              itemLabel={(line) => line.label}
              renderItem={(line, updateLine) => (
                <div className={GRID}>
                  <TextField label="Label" value={line.label} onChange={(v) => updateLine({ label: v })} />
                  <TextField label="Price" value={line.price} onChange={(v) => updateLine({ price: v })} />
                </div>
              )}
            />
          </div>
        )}
      />
    </div>
  );
}

/* ─── Blog / Journal ───────────────────────────────────────────────────────── */

function BlogForm({ data, onChange, media }: FormProps<BlogData>) {
  const set = <K extends keyof BlogData>(key: K, value: BlogData[K]) =>
    onChange({ ...data, [key]: value });

  return (
    <div className="space-y-4">
      <div className={GRID}>
        <TextField label="Eyebrow" value={data.eyebrow} onChange={(v) => set("eyebrow", v)} />
        <TextField label="Heading" value={data.titleLead} onChange={(v) => set("titleLead", v)} />
        <TextField label="Highlighted word" value={data.titleAccent} onChange={(v) => set("titleAccent", v)} />
        <TextField label="Card link text" value={data.readLabel} onChange={(v) => set("readLabel", v)} />
      </div>
      <TextAreaField label="Paragraph" value={data.paragraph} onChange={(v) => set("paragraph", v)} />
      <LinkField label="Button" value={data.cta} onChange={(v) => set("cta", v)} />

      <RepeatableList
        title="Scrolling categories"
        items={data.ticker}
        onChange={(ticker) => set("ticker", ticker)}
        createItem={() => ({ id: newItemId("blog-ticker"), label: "" })}
        itemLabel={(item) => item.label}
        renderItem={(item, update) => (
          <TextField label="Text" value={item.label} onChange={(v) => update({ label: v })} />
        )}
      />

      <RepeatableList
        title="Posts"
        items={data.posts}
        onChange={(posts) => set("posts", posts)}
        createItem={() => ({
          id: newItemId("post"),
          image: { url: "", alt: "" },
          tag: "",
          date: "",
          title: "",
          href: "/blog",
          hidden: false,
        })}
        itemLabel={(item) => item.title}
        isHidden={(item) => item.hidden}
        onToggleHidden={(item) => ({ ...item, hidden: !item.hidden })}
        renderItem={(item, update) => (
          <div className="space-y-3">
            <TextField label="Title" value={item.title} onChange={(v) => update({ title: v })} />
            <div className="grid gap-4 sm:grid-cols-3">
              <TextField label="Tag" value={item.tag} onChange={(v) => update({ tag: v })} />
              <TextField label="Date" value={item.date} onChange={(v) => update({ date: v })} hint="Free text, e.g. Mar 12, 2026" />
              <TextField label="Link" value={item.href} onChange={(v) => update({ href: v })} />
            </div>
            <ImageField
              label="Cover image"
              value={item.image}
              onChange={(v) => update({ image: v })}
              library={media.library}
              onIndexed={media.onIndexed}
              category="Journal"
            />
          </div>
        )}
      />
    </div>
  );
}

/* ─── Testimonials ─────────────────────────────────────────────────────────── */

function TestimonialsForm({ data, onChange }: FormProps<TestimonialsData>) {
  const set = <K extends keyof TestimonialsData>(key: K, value: TestimonialsData[K]) =>
    onChange({ ...data, [key]: value });

  return (
    <div className="space-y-4">
      <div className={GRID}>
        <TextField label="Eyebrow" value={data.eyebrow} onChange={(v) => set("eyebrow", v)} />
        <TextField label="Title" value={data.title} onChange={(v) => set("title", v)} />
      </div>

      <RepeatableList
        title="Testimonials"
        items={data.items}
        onChange={(items) => set("items", items)}
        createItem={() => ({ id: newItemId("testimonial"), name: "", role: "", text: "", rating: 5, hidden: false })}
        itemLabel={(item) => item.name}
        isHidden={(item) => item.hidden}
        onToggleHidden={(item) => ({ ...item, hidden: !item.hidden })}
        renderItem={(item, update) => (
          <div className="space-y-3">
            <div className="grid gap-4 sm:grid-cols-3">
              <TextField label="Name" value={item.name} onChange={(v) => update({ name: v })} />
              <TextField label="Role" value={item.role} onChange={(v) => update({ role: v })} />
              <NumberField label="Rating (0–5)" value={item.rating} onChange={(v) => update({ rating: Math.min(5, Math.max(0, v)) })} />
            </div>
            <TextAreaField label="Quote" value={item.text} onChange={(v) => update({ text: v })} />
          </div>
        )}
      />
    </div>
  );
}

/* ─── FAQ ──────────────────────────────────────────────────────────────────── */

function FaqForm({ data, onChange }: FormProps<FaqData>) {
  const set = <K extends keyof FaqData>(key: K, value: FaqData[K]) =>
    onChange({ ...data, [key]: value });

  return (
    <div className="space-y-4">
      <div className={GRID}>
        <TextField label="Eyebrow" value={data.eyebrow} onChange={(v) => set("eyebrow", v)} />
        <TextField label="Title" value={data.title} onChange={(v) => set("title", v)} />
      </div>
      <TextAreaField label="Subtitle" value={data.subtitle} onChange={(v) => set("subtitle", v)} rows={2} />

      <RepeatableList
        title="Questions"
        items={data.items}
        onChange={(items) => set("items", items)}
        createItem={() => ({ id: newItemId("faq"), question: "", answer: "", hidden: false })}
        itemLabel={(item) => item.question}
        isHidden={(item) => item.hidden}
        onToggleHidden={(item) => ({ ...item, hidden: !item.hidden })}
        renderItem={(item, update) => (
          <div className="space-y-3">
            <TextField label="Question" value={item.question} onChange={(v) => update({ question: v })} />
            <TextAreaField label="Answer" value={item.answer} onChange={(v) => update({ answer: v })} />
          </div>
        )}
      />
    </div>
  );
}

/* ─── Contact ──────────────────────────────────────────────────────────────── */

function ContactForm({ data, onChange, media }: FormProps<ContactData>) {
  const set = <K extends keyof ContactData>(key: K, value: ContactData[K]) =>
    onChange({ ...data, [key]: value });

  return (
    <div className="space-y-4">
      <TextField label="Title" value={data.title} onChange={(v) => set("title", v)} />
      <TextAreaField label="Tagline" value={data.tagline} onChange={(v) => set("tagline", v)} rows={2} />
      <div className={GRID}>
        <TextField label="Address" value={data.address} onChange={(v) => set("address", v)} />
        <TextField label="Phone" value={data.phone} onChange={(v) => set("phone", v)} />
        <TextField label="Email" value={data.email} onChange={(v) => set("email", v)} />
        <TextField label="Enquiry panel name (for screen readers)" value={data.formTitle} onChange={(v) => set("formTitle", v)} />
      </div>

      <ImageField
        label="Background image"
        value={data.backgroundImage}
        onChange={(v) => set("backgroundImage", v)}
        library={media.library}
        onIndexed={media.onIndexed}
        category="Contact"
      />

      <div className={GRID}>
        <TextField label="Name field label" value={data.nameLabel} onChange={(v) => set("nameLabel", v)} />
        <TextField label="Name field placeholder" value={data.namePlaceholder} onChange={(v) => set("namePlaceholder", v)} />
        <TextField label="Phone field label" value={data.phoneLabel} onChange={(v) => set("phoneLabel", v)} />
        <TextField label="Phone field placeholder" value={data.phonePlaceholder} onChange={(v) => set("phonePlaceholder", v)} />
        <TextField label="Email field label" value={data.emailLabel} onChange={(v) => set("emailLabel", v)} />
        <TextField label="Email field placeholder" value={data.emailPlaceholder} onChange={(v) => set("emailPlaceholder", v)} />
      </div>

      <LinkField label="Button" value={data.cta} onChange={(v) => set("cta", v)} />
    </div>
  );
}

/* ─── Dispatcher ───────────────────────────────────────────────────────────── */

export function SectionForm({
  section,
  onChange,
  media,
}: {
  section: Section;
  onChange: (section: Section) => void;
  media: MediaBridge;
}) {
  // Each branch narrows `section`, so `section.data` and the form's `data` prop
  // are the same concrete type — no casting anywhere.
  switch (section.type) {
    case "HERO":
      return <HeroForm data={section.data} media={media} onChange={(data) => onChange({ ...section, data })} />;
    case "EXPERIENCE":
      return <ExperienceForm data={section.data} media={media} onChange={(data) => onChange({ ...section, data })} />;
    case "SERVICES":
      return <ServicesForm data={section.data} media={media} onChange={(data) => onChange({ ...section, data })} />;
    case "BENEFITS":
      return <BenefitsForm data={section.data} media={media} onChange={(data) => onChange({ ...section, data })} />;
    case "GALLERY":
      return <GalleryForm data={section.data} media={media} onChange={(data) => onChange({ ...section, data })} />;
    case "PRICING":
      return <PricingForm data={section.data} media={media} onChange={(data) => onChange({ ...section, data })} />;
    case "BLOG":
      return <BlogForm data={section.data} media={media} onChange={(data) => onChange({ ...section, data })} />;
    case "TESTIMONIALS":
      return <TestimonialsForm data={section.data} media={media} onChange={(data) => onChange({ ...section, data })} />;
    case "FAQ":
      return <FaqForm data={section.data} media={media} onChange={(data) => onChange({ ...section, data })} />;
    case "CONTACT":
      return <ContactForm data={section.data} media={media} onChange={(data) => onChange({ ...section, data })} />;
  }
}
