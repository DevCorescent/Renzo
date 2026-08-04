"use client";

// ============================================================================
// OWNER  : Gauransh
// MODULE : Super Admin — Homepage CMS editor
//
// THE WORKFLOW THIS ENFORCES
//   edit → save draft → preview → review → publish → live
//
// Editing changes local state only. "Save draft" persists to the draft document,
// which the public site never reads. "Publish" is the single action that moves
// the draft to live, and it always writes a numbered version first, so every
// publish is reversible.
//
// Two distinct "unsaved" states are surfaced, because confusing them is how a
// change gets lost or published by accident:
//   • unsaved      — edited here but not yet written to the draft
//   • unpublished  — saved to the draft but not yet live
//
// ACCESS: the page that renders this is SUPER_ADMIN-gated, and every endpoint it
// calls re-checks the role server-side.
// ============================================================================

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  ArrowDown,
  ArrowUp,
  ChevronDown,
  ChevronRight,
  ExternalLink,
  Plus,
  RotateCcw,
  Trash2,
  Undo2,
} from "lucide-react";

import { Badge, Card, CardBody, CardHeader, CardTitle } from "@/components/shared/ui";
import { Button } from "@/components/ui/button";
import { API } from "@/lib/endpoints";
import { cn } from "@/lib/utils";
import { createSection } from "@/lib/cms/defaults";
import {
  SECTION_LABELS,
  SECTION_TYPES,
  SINGLETON_SECTIONS,
  SOCIAL_ICON_NAMES,
  type HomeContent,
  type MediaItem,
  type Section,
  type SectionType,
  type SocialIconName,
} from "@/lib/cms/schema";

import {
  IconButton,
  ImageField,
  LinkField,
  RepeatableList,
  TextAreaField,
  TextField,
  newItemId,
} from "./homepage-cms/fields";
import { MediaLibraryPanel } from "./homepage-cms/media-library";
import { SectionForm, type MediaBridge } from "./homepage-cms/section-forms";

/* ─── Wire helpers ─────────────────────────────────────────────────────────── */

type VersionSummary = {
  version: number;
  publishedAt: string;
  publishedBy: string;
  summary: string;
  isCurrent: boolean;
};

export type HomepageCmsData = {
  draft: { content: HomeContent; updatedAt: string; updatedBy: string };
  live: { version: number; content: HomeContent; publishedAt: string; publishedBy: string } | null;
  versions: VersionSummary[];
};

/**
 * Every route in this project answers `{ success, message, data }`. Unwrapping in
 * one place means no caller can mistake the envelope for the payload — reading
 * `body.draft` instead of `body.data.draft` is exactly the kind of silent failure
 * this avoids.
 */
async function apiJson<T>(input: string, init?: RequestInit): Promise<T> {
  const res = await fetch(input, {
    cache: "no-store",
    ...init,
    headers: init?.body ? { "Content-Type": "application/json", ...init.headers } : init?.headers,
  });

  const body = (await res.json().catch(() => null)) as
    | { success?: boolean; message?: string; data?: T }
    | null;

  if (!res.ok || !body?.success) {
    throw new Error(body?.message ?? "Request failed");
  }
  return body.data as T;
}

function formatWhen(iso: string): string {
  const date = new Date(iso);
  return Number.isNaN(date.getTime()) ? "—" : date.toLocaleString("en-IN");
}

/**
 * What differs between two documents, named in the author's language. Powers the
 * "review before publish" step — a list of what is about to change beats a bare
 * "you have unpublished changes".
 */
function describeChanges(draft: HomeContent, live: HomeContent | null): string[] {
  if (!live) return ["Publishing for the first time — the homepage becomes CMS-managed."];

  const changes: string[] = [];
  const liveById = new Map(live.sections.map((section) => [section.id, section]));

  for (const section of draft.sections) {
    const previous = liveById.get(section.id);
    const name = section.label || SECTION_LABELS[section.type];
    if (!previous) {
      changes.push(`${name} — added`);
      continue;
    }
    if (previous.enabled !== section.enabled) {
      changes.push(`${name} — ${section.enabled ? "shown" : "hidden"}`);
    }
    if (JSON.stringify(previous.data) !== JSON.stringify(section.data)) {
      changes.push(`${name} — content edited`);
    }
  }

  const draftIds = new Set(draft.sections.map((section) => section.id));
  for (const section of live.sections) {
    if (!draftIds.has(section.id)) {
      changes.push(`${section.label || SECTION_LABELS[section.type]} — removed`);
    }
  }

  const draftOrder = draft.sections.map((s) => s.id).join("|");
  const liveOrder = live.sections.filter((s) => draftIds.has(s.id)).map((s) => s.id).join("|");
  if (draftOrder !== liveOrder) changes.push("Section order changed");

  if (JSON.stringify(draft.branding) !== JSON.stringify(live.branding)) changes.push("Branding edited");
  if (JSON.stringify(draft.footer) !== JSON.stringify(live.footer)) changes.push("Footer edited");

  return changes;
}

/* ─── Editor ───────────────────────────────────────────────────────────────── */

export function HomepageCmsEditor({
  initialData,
  initialMedia,
}: {
  initialData: HomepageCmsData;
  initialMedia: MediaItem[];
}) {
  const router = useRouter();

  // Seeded from the server render. Fetching this in an effect instead would mean
  // an avoidable loading flash and a second round trip for data the page already
  // had — and the initial state would have to be invented while it arrived.
  const [content, setContent] = React.useState<HomeContent>(initialData.draft.content);
  const [savedContent, setSavedContent] = React.useState<HomeContent>(initialData.draft.content);
  const [live, setLive] = React.useState<HomepageCmsData["live"]>(initialData.live);
  const [versions, setVersions] = React.useState<VersionSummary[]>(initialData.versions);
  const [media, setMedia] = React.useState<MediaItem[]>(initialMedia);
  const [draftMeta, setDraftMeta] = React.useState<{ updatedAt: string; updatedBy: string }>({
    updatedAt: initialData.draft.updatedAt,
    updatedBy: initialData.draft.updatedBy,
  });

  const [busy, setBusy] = React.useState<null | "save" | "publish" | "discard" | "restore" | "media">(null);
  const [status, setStatus] = React.useState<{ tone: "ok" | "error"; text: string } | null>(null);
  const [summary, setSummary] = React.useState("");
  const [openSection, setOpenSection] = React.useState<string | null>(null);
  const [addType, setAddType] = React.useState<SectionType>("SERVICES");

  // Re-reads the server state after an action that changes it (publish, restore,
  // discard). Only ever called from an event handler, never from an effect.
  const refresh = React.useCallback(async () => {
    try {
      const [cms, mediaData] = await Promise.all([
        apiJson<HomepageCmsData>(API.admin.cmsHomepage),
        apiJson<{ items: MediaItem[] }>(`${API.admin.cmsMedia}?includeDeleted=true`),
      ]);
      setContent(cms.draft.content);
      setSavedContent(cms.draft.content);
      setDraftMeta({ updatedAt: cms.draft.updatedAt, updatedBy: cms.draft.updatedBy });
      setLive(cms.live);
      setVersions(cms.versions);
      setMedia(mediaData.items);
      setStatus(null);
    } catch (e) {
      setStatus({ tone: "error", text: e instanceof Error ? e.message : "Could not reload the Homepage CMS" });
    }
  }, []);

  const dirty = JSON.stringify(content) !== JSON.stringify(savedContent);
  const pendingChanges = React.useMemo(
    () => describeChanges(savedContent, live?.content ?? null),
    [savedContent, live]
  );

  /* ─── Mutations ──────────────────────────────────────────────────────────── */

  const patch = (updater: (current: HomeContent) => HomeContent) => setContent(updater);

  const replaceSection = (next: Section) =>
    patch((current) => ({
      ...current,
      sections: current.sections.map((section) => (section.id === next.id ? next : section)),
    }));

  const moveSection = (index: number, delta: number) =>
    patch((current) => {
      const target = index + delta;
      if (target < 0 || target >= current.sections.length) return current;
      const sections = [...current.sections];
      const [moved] = sections.splice(index, 1);
      sections.splice(target, 0, moved);
      return { ...current, sections };
    });

  const removeSection = (id: string) =>
    patch((current) => ({ ...current, sections: current.sections.filter((s) => s.id !== id) }));

  const addSection = () =>
    patch((current) => ({
      ...current,
      sections: [...current.sections, createSection(addType, newItemId("new").slice(-8))],
    }));

  const save = async () => {
    setBusy("save");
    try {
      const data = await apiJson<{ draft: { content: HomeContent; updatedAt: string; updatedBy: string } }>(
        API.admin.cmsHomepage,
        { method: "PUT", body: JSON.stringify({ content }) }
      );
      setSavedContent(data.draft.content);
      setDraftMeta({ updatedAt: data.draft.updatedAt, updatedBy: data.draft.updatedBy });
      setStatus({ tone: "ok", text: "Draft saved — nothing is live yet. Preview it, then publish." });
    } catch (e) {
      setStatus({ tone: "error", text: e instanceof Error ? e.message : "Could not save the draft" });
    } finally {
      setBusy(null);
    }
  };

  const publish = async () => {
    // Publishing sends the SAVED draft, so unsaved local edits would be silently
    // left behind. Refuse rather than publish something the author cannot preview.
    if (dirty) {
      setStatus({ tone: "error", text: "Save the draft before publishing — you have unsaved edits." });
      return;
    }
    setBusy("publish");
    try {
      const data = await apiJson<{ version: number }>(API.admin.cmsHomepagePublish, {
        method: "POST",
        body: JSON.stringify({ summary }),
      });
      setSummary("");
      await refresh();
      setStatus({ tone: "ok", text: `Published version ${data.version}. The homepage is live.` });
      router.refresh();
    } catch (e) {
      setStatus({ tone: "error", text: e instanceof Error ? e.message : "Could not publish" });
    } finally {
      setBusy(null);
    }
  };

  const discard = async () => {
    setBusy("discard");
    try {
      await apiJson(API.admin.cmsHomepage, { method: "DELETE" });
      await refresh();
      setStatus({ tone: "ok", text: "Draft reset to the live homepage." });
    } catch (e) {
      setStatus({ tone: "error", text: e instanceof Error ? e.message : "Could not discard the draft" });
    } finally {
      setBusy(null);
    }
  };

  const restore = async (version: number) => {
    setBusy("restore");
    try {
      await apiJson(API.admin.cmsHomepageVersion(version), { method: "POST" });
      await refresh();
      setStatus({
        tone: "ok",
        text: `Version ${version} loaded into the draft. Preview it, then publish to make it live.`,
      });
    } catch (e) {
      setStatus({ tone: "error", text: e instanceof Error ? e.message : "Could not restore that version" });
    } finally {
      setBusy(null);
    }
  };

  /* ─── Media ──────────────────────────────────────────────────────────────── */

  const indexMedia = React.useCallback(async (url: string, category: string) => {
    try {
      const data = await apiJson<{ item: MediaItem }>(API.admin.cmsMedia, {
        method: "POST",
        body: JSON.stringify({ url, category, name: url.split("/").pop() ?? "Image" }),
      });
      setMedia((current) => [data.item, ...current.filter((item) => item.id !== data.item.id)]);
    } catch {
      // Indexing is a convenience: the image is already uploaded and already set
      // on the field, so a failure here must not interrupt the author's edit.
    }
  }, []);

  const patchMedia = async (
    id: string,
    changes: Partial<Pick<MediaItem, "name" | "alt" | "category" | "deleted">>
  ) => {
    // Optimistic: typing in the name/alt inputs must feel immediate. A failure
    // reloads from the server so the panel can never drift from what was stored.
    setMedia((current) => current.map((item) => (item.id === id ? { ...item, ...changes } : item)));
    setBusy("media");
    try {
      await apiJson(API.admin.cmsMediaItem(id), { method: "PATCH", body: JSON.stringify(changes) });
    } catch (e) {
      setStatus({ tone: "error", text: e instanceof Error ? e.message : "Could not update that image" });
      await refresh();
    } finally {
      setBusy(null);
    }
  };

  const mediaBridge: MediaBridge = React.useMemo(
    () => ({ library: media, onIndexed: (url, category) => void indexMedia(url, category) }),
    [media, indexMedia]
  );

  /* ─── Render ─────────────────────────────────────────────────────────────── */

  const usedTypes = new Set(content.sections.map((s) => s.type));
  const addableTypes = SECTION_TYPES.filter(
    (type) => !(SINGLETON_SECTIONS.includes(type) && usedTypes.has(type))
  );

  return (
    <div className="space-y-6">
      {/* Header + workflow actions */}
      <div className="rounded border border-gray-200 bg-white p-5 dark:border-(--sa-border) dark:bg-(--sa-surface)">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <h1 className="text-xl font-semibold text-gray-900 dark:text-(--sa-text)">Homepage CMS</h1>
            <p className="mt-1 text-sm text-gray-500 dark:text-(--sa-text-2)">
              Edit the words and images on the public homepage. Fonts, colours, layout and
              responsive behaviour are fixed in code and cannot be changed here.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Link
              href="/cms-preview"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex h-9 items-center gap-1.5 rounded border border-gray-200 px-4 text-xs font-semibold uppercase tracking-widest text-gray-700 transition-colors hover:bg-gray-50 dark:border-(--sa-border) dark:text-(--sa-text) dark:hover:bg-(--sa-hover)"
            >
              <ExternalLink className="size-3.5" />
              Preview draft
            </Link>
            <Button size="sm" variant="outline" onClick={() => void save()} disabled={busy !== null || !dirty}>
              {busy === "save" ? "Saving…" : dirty ? "Save draft" : "Saved"}
            </Button>
            <Button size="sm" onClick={() => void publish()} disabled={busy !== null}>
              {busy === "publish" ? "Publishing…" : "Publish"}
            </Button>
          </div>
        </div>

        <div className="mt-4 flex flex-wrap items-center gap-x-4 gap-y-2 border-t border-gray-100 pt-3 text-xs text-gray-500 dark:border-(--sa-border) dark:text-(--sa-text-2)">
          <span>
            Live version:{" "}
            <strong className="text-gray-900 dark:text-(--sa-text)">
              {live ? `v${live.version}` : "not published"}
            </strong>
          </span>
          {draftMeta && (
            <span>
              Draft saved {formatWhen(draftMeta.updatedAt)}
              {draftMeta.updatedBy ? ` by ${draftMeta.updatedBy}` : ""}
            </span>
          )}
          {dirty && <Badge tone="warning">Unsaved edits</Badge>}
          {!dirty && pendingChanges.length > 0 && <Badge tone="info">Unpublished changes</Badge>}
          {!dirty && pendingChanges.length === 0 && live && <Badge tone="success">Draft matches live</Badge>}
        </div>

        {status && (
          <p
            className={cn(
              "mt-3 rounded px-3 py-2 text-xs",
              status.tone === "ok"
                ? "bg-green-50 text-green-700 dark:bg-emerald-500/15 dark:text-emerald-300"
                : "bg-red-50 text-red-600 dark:bg-red-500/15 dark:text-red-300"
            )}
          >
            {status.text}
          </p>
        )}
      </div>

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1.35fr)_minmax(0,0.65fr)]">
        {/* ─── Sections ─────────────────────────────────────────────────────── */}
        <div className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Sections</CardTitle>
              <Badge tone="neutral">{content.sections.filter((s) => s.enabled).length} shown</Badge>
            </CardHeader>
            <CardBody className="space-y-3">
              {content.sections.map((section, index) => {
                const expanded = openSection === section.id;
                const name = section.label || SECTION_LABELS[section.type];
                return (
                  <div
                    key={section.id}
                    className={cn(
                      "rounded border border-gray-200 dark:border-(--sa-border)",
                      !section.enabled && "bg-gray-50/60 dark:bg-white/2"
                    )}
                  >
                    <div className="flex flex-wrap items-center gap-2 p-3">
                      <button
                        type="button"
                        onClick={() => setOpenSection(expanded ? null : section.id)}
                        aria-expanded={expanded}
                        className="flex min-w-0 flex-1 items-center gap-2 text-left"
                      >
                        {expanded ? (
                          <ChevronDown className="size-4 shrink-0 text-gray-400" />
                        ) : (
                          <ChevronRight className="size-4 shrink-0 text-gray-400" />
                        )}
                        <span className="truncate text-sm font-medium text-gray-900 dark:text-(--sa-text)">
                          {name}
                        </span>
                        <span className="shrink-0 text-[11px] uppercase tracking-wider text-gray-400">
                          {section.type}
                        </span>
                        {!section.enabled && <Badge tone="neutral">Hidden</Badge>}
                      </button>

                      <div className="flex shrink-0 items-center gap-1">
                        <label className="mr-1 flex items-center gap-1.5 text-[11px] text-gray-500 dark:text-(--sa-text-2)">
                          <input
                            type="checkbox"
                            checked={section.enabled}
                            onChange={(e) => replaceSection({ ...section, enabled: e.target.checked })}
                            className="size-4 rounded border-gray-300"
                          />
                          Show
                        </label>
                        <IconButton label="Move up" disabled={index === 0} onClick={() => moveSection(index, -1)}>
                          <ArrowUp className="size-3.5" />
                        </IconButton>
                        <IconButton
                          label="Move down"
                          disabled={index === content.sections.length - 1}
                          onClick={() => moveSection(index, 1)}
                        >
                          <ArrowDown className="size-3.5" />
                        </IconButton>
                        <IconButton label="Delete section" destructive onClick={() => removeSection(section.id)}>
                          <Trash2 className="size-3.5" />
                        </IconButton>
                      </div>
                    </div>

                    {expanded && (
                      <div className="space-y-4 border-t border-gray-100 p-4 dark:border-(--sa-border)">
                        <TextField
                          label="Name in this list (admin only — never shown on the site)"
                          value={section.label}
                          onChange={(label) => replaceSection({ ...section, label })}
                          placeholder={SECTION_LABELS[section.type]}
                        />
                        <SectionForm section={section} onChange={replaceSection} media={mediaBridge} />
                      </div>
                    )}
                  </div>
                );
              })}

              <div className="flex flex-wrap items-center gap-2 border-t border-gray-100 pt-3 dark:border-(--sa-border)">
                <select
                  value={addType}
                  onChange={(e) => setAddType(e.target.value as SectionType)}
                  aria-label="Section type to add"
                  className="rounded border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 dark:border-(--sa-border) dark:bg-(--sa-surface) dark:text-(--sa-text)"
                >
                  {addableTypes.map((type) => (
                    <option key={type} value={type}>
                      {SECTION_LABELS[type]}
                    </option>
                  ))}
                </select>
                <Button size="sm" variant="outline" onClick={addSection}>
                  <Plus className="size-3.5" />
                  Add section
                </Button>
                <span className="text-[11px] text-gray-400 dark:text-(--sa-muted)">
                  New sections reuse an existing layout — only their content is new.
                </span>
              </div>
            </CardBody>
          </Card>

          {/* ─── Branding ───────────────────────────────────────────────────── */}
          <Card>
            <CardHeader>
              <CardTitle>Branding</CardTitle>
            </CardHeader>
            <CardBody className="space-y-4">
              <TextField
                label="Site name"
                value={content.branding.siteName}
                onChange={(siteName) => patch((c) => ({ ...c, branding: { ...c.branding, siteName } }))}
              />
              <ImageField
                label="Header logo"
                value={content.branding.logoImage}
                onChange={(logoImage) => patch((c) => ({ ...c, branding: { ...c.branding, logoImage } }))}
                library={media}
                onIndexed={(url, category) => void indexMedia(url, category)}
                category="Branding"
              />
              <ImageField
                label="Footer logo"
                value={content.branding.footerLogoImage}
                onChange={(footerLogoImage) =>
                  patch((c) => ({ ...c, branding: { ...c.branding, footerLogoImage } }))
                }
                library={media}
                onIndexed={(url, category) => void indexMedia(url, category)}
                category="Branding"
              />
              <ImageField
                label="Hero watermark"
                value={content.branding.watermarkImage}
                onChange={(watermarkImage) =>
                  patch((c) => ({ ...c, branding: { ...c.branding, watermarkImage } }))
                }
                library={media}
                onIndexed={(url, category) => void indexMedia(url, category)}
                category="Branding"
              />
              <TextField
                label="Favicon URL"
                value={content.branding.faviconUrl}
                onChange={(faviconUrl) => patch((c) => ({ ...c, branding: { ...c.branding, faviconUrl } }))}
                hint="Applies to the public website only. Leave empty to keep the built-in icon."
              />
            </CardBody>
          </Card>

          {/* ─── Footer ─────────────────────────────────────────────────────── */}
          <Card>
            <CardHeader>
              <CardTitle>Footer</CardTitle>
            </CardHeader>
            <CardBody className="space-y-4">
              <TextAreaField
                label="Tagline"
                value={content.footer.tagline}
                onChange={(tagline) => patch((c) => ({ ...c, footer: { ...c.footer, tagline } }))}
                rows={2}
              />
              <div className="grid gap-4 sm:grid-cols-2">
                <TextField
                  label="Contact heading"
                  value={content.footer.contactTitle}
                  onChange={(contactTitle) => patch((c) => ({ ...c, footer: { ...c.footer, contactTitle } }))}
                />
                <TextField
                  label="Address"
                  value={content.footer.address}
                  onChange={(address) => patch((c) => ({ ...c, footer: { ...c.footer, address } }))}
                />
                <TextField
                  label="Phone"
                  value={content.footer.phone}
                  onChange={(phone) => patch((c) => ({ ...c, footer: { ...c.footer, phone } }))}
                />
                <TextField
                  label="Email"
                  value={content.footer.email}
                  onChange={(email) => patch((c) => ({ ...c, footer: { ...c.footer, email } }))}
                />
              </div>
              <TextField
                label="Copyright"
                value={content.footer.copyright}
                onChange={(copyright) => patch((c) => ({ ...c, footer: { ...c.footer, copyright } }))}
                hint="Rendered after the © and the current year, which updates itself."
              />

              <RepeatableList
                title="Link columns"
                items={content.footer.columns}
                onChange={(columns) => patch((c) => ({ ...c, footer: { ...c.footer, columns } }))}
                createItem={() => ({ id: newItemId("footer-col"), title: "", links: [] })}
                itemLabel={(column) => column.title}
                renderItem={(column, update) => (
                  <div className="space-y-3">
                    <TextField label="Heading" value={column.title} onChange={(title) => update({ title })} />
                    <RepeatableList
                      title="Links"
                      items={column.links}
                      onChange={(links) => update({ links })}
                      createItem={() => ({ id: newItemId("footer-link"), label: "", href: "" })}
                      itemLabel={(link) => link.label}
                      renderItem={(link, updateLink) => (
                        <LinkField
                          label="Link"
                          value={{ label: link.label, href: link.href }}
                          onChange={(v) => updateLink({ label: v.label, href: v.href })}
                        />
                      )}
                    />
                  </div>
                )}
              />

              <RepeatableList
                title="Social links"
                items={content.footer.socials}
                onChange={(socials) => patch((c) => ({ ...c, footer: { ...c.footer, socials } }))}
                createItem={() => ({
                  id: newItemId("social"),
                  icon: "Instagram" as SocialIconName,
                  label: "Instagram",
                  href: "#",
                })}
                itemLabel={(social) => social.label}
                renderItem={(social, update) => (
                  <div className="grid gap-4 sm:grid-cols-3">
                    <label className="block space-y-1.5">
                      <span className="text-xs font-medium text-gray-600 dark:text-(--sa-text-2)">Network</span>
                      <select
                        value={social.icon}
                        onChange={(e) => update({ icon: e.target.value as SocialIconName })}
                        className="w-full rounded border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 dark:border-(--sa-border) dark:bg-(--sa-surface) dark:text-(--sa-text)"
                      >
                        {SOCIAL_ICON_NAMES.map((name) => (
                          <option key={name} value={name}>
                            {name}
                          </option>
                        ))}
                      </select>
                    </label>
                    <TextField label="Label" value={social.label} onChange={(label) => update({ label })} />
                    <TextField label="Link" value={social.href} onChange={(href) => update({ href })} />
                  </div>
                )}
              />

              <RepeatableList
                title="Legal links"
                items={content.footer.legalLinks}
                onChange={(legalLinks) => patch((c) => ({ ...c, footer: { ...c.footer, legalLinks } }))}
                createItem={() => ({ id: newItemId("legal"), label: "", href: "" })}
                itemLabel={(link) => link.label}
                renderItem={(link, update) => (
                  <LinkField
                    label="Link"
                    value={{ label: link.label, href: link.href }}
                    onChange={(v) => update({ label: v.label, href: v.href })}
                  />
                )}
              />
            </CardBody>
          </Card>
        </div>

        {/* ─── Review / publish / history / media ───────────────────────────── */}
        <div className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Review &amp; publish</CardTitle>
            </CardHeader>
            <CardBody className="space-y-3">
              {dirty && (
                <p className="rounded bg-gray-100 px-3 py-2 text-xs text-gray-700 dark:bg-white/15 dark:text-gray-200">
                  You have edits that are not in the draft yet. Save the draft to preview them.
                </p>
              )}

              <div>
                <p className="text-xs font-medium text-gray-600 dark:text-(--sa-text-2)">Waiting to go live</p>
                {pendingChanges.length === 0 ? (
                  <p className="mt-1.5 text-xs text-gray-400 dark:text-(--sa-muted)">
                    Nothing to publish — the draft matches the live homepage.
                  </p>
                ) : (
                  <ul className="mt-1.5 space-y-1 text-xs text-gray-700 dark:text-(--sa-text)">
                    {pendingChanges.map((change) => (
                      <li key={change} className="flex gap-1.5">
                        <span aria-hidden className="text-gray-300">
                          •
                        </span>
                        {change}
                      </li>
                    ))}
                  </ul>
                )}
              </div>

              <TextAreaField
                label="Publish note (stored with the version)"
                value={summary}
                onChange={setSummary}
                rows={2}
              />

              <div className="flex flex-wrap gap-2">
                <Button size="sm" onClick={() => void publish()} disabled={busy !== null}>
                  {busy === "publish" ? "Publishing…" : "Publish to live"}
                </Button>
                <Button size="sm" variant="outline" onClick={() => void discard()} disabled={busy !== null}>
                  <Undo2 className="size-3.5" />
                  {busy === "discard" ? "Discarding…" : "Discard draft"}
                </Button>
              </div>
            </CardBody>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Version history</CardTitle>
              <Badge tone="neutral">{versions.length}</Badge>
            </CardHeader>
            <CardBody>
              {versions.length === 0 ? (
                <p className="text-xs text-gray-400 dark:text-(--sa-muted)">
                  Nothing published yet. The homepage is showing its built-in content.
                </p>
              ) : (
                <ul className="space-y-2">
                  {versions.map((version) => (
                    <li
                      key={version.version}
                      className="flex items-start justify-between gap-3 rounded border border-gray-200 p-3 dark:border-(--sa-border)"
                    >
                      <div className="min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="text-sm font-medium text-gray-900 dark:text-(--sa-text)">
                            Version {version.version}
                          </span>
                          {version.isCurrent && <Badge tone="success">Live</Badge>}
                        </div>
                        <p className="mt-0.5 text-[11px] text-gray-500 dark:text-(--sa-text-2)">
                          {formatWhen(version.publishedAt)}
                          {version.publishedBy ? ` · ${version.publishedBy}` : ""}
                        </p>
                        {version.summary && (
                          <p className="mt-1 text-xs text-gray-600 dark:text-(--sa-text-2)">{version.summary}</p>
                        )}
                      </div>
                      <button
                        type="button"
                        disabled={busy !== null}
                        onClick={() => void restore(version.version)}
                        title={`Load version ${version.version} into the draft`}
                        className="inline-flex shrink-0 items-center gap-1 rounded border border-gray-200 px-2 py-1 text-[11px] text-gray-600 transition-colors hover:bg-gray-50 disabled:opacity-40 dark:border-(--sa-border) dark:text-(--sa-text-2) dark:hover:bg-(--sa-hover)"
                      >
                        <RotateCcw className="size-3" />
                        Restore
                      </button>
                    </li>
                  ))}
                </ul>
              )}
              <p className="mt-3 text-[11px] text-gray-400 dark:text-(--sa-muted)">
                Restoring loads that version into the draft. It only reaches the public site when you
                publish, so a rollback is reviewable like any other change.
              </p>
            </CardBody>
          </Card>

          <MediaLibraryPanel
            items={media}
            busy={busy === "media"}
            onUpload={(url) => void indexMedia(url, "General")}
            onPatch={(id, changes) => void patchMedia(id, changes)}
          />
        </div>
      </div>
    </div>
  );
}
