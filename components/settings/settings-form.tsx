"use client";

// ============================================================================
// OWNER  : Gauransh
// MODULE : Super Admin — Platform Settings (form)
// FLOW   : Skeleton → GET /admin/settings → populate → dirty tracking per section →
//          enable that section's Save → PATCH (spinner, disabled) → success toast +
//          rebaseline, staying on the page. No refresh, single fetch.
// ACCESS : Rendered only by the SUPER_ADMIN-guarded page; the API re-checks the role.
// BACKEND: GET + PATCH /api/v1/admin/settings (PlatformConfig singleton). PATCH is
//          partial — each section saves only its own fields.
// PURPOSE: The one editable Settings surface (General / Booking) + read-only System.
// ============================================================================

import * as React from "react";
import { Check, X, AlertTriangle, Loader2 } from "lucide-react";
import { Card, CardHeader, CardTitle, CardBody } from "@/components/shared/ui";
import { Skeleton } from "@/components/dashboard/loading-skeleton";
import { API } from "@/lib/endpoints";
import { cn } from "@/lib/utils";

// ── Types mirror exactly what GET /admin/settings returns ─────────────────────
type Config = {
  businessName: string;
  supportEmail: string | null;
  supportPhone: string | null;
  whatsappNumber: string | null;
  instagramHandle: string | null;
  facebookHandle: string | null;
  youtubeHandle: string | null;
  twitterHandle: string | null;
  maintenanceMode: boolean;
  maintenanceMessage: string | null;
  defaultBookingSlotMin: number;
  reviewAutoApprove: boolean;
  portfolioAutoApprove: boolean;
};
type SystemStatus = { version: string; database: string; server: string; environment: string; lastUpdated: string };
type Envelope<T> = { success: boolean; message: string; data?: T; errors?: Record<string, string[]> };

// Editable form shape — text/number fields held as strings, toggles as booleans.
type Form = {
  businessName: string; supportEmail: string; supportPhone: string; whatsappNumber: string;
  instagramHandle: string; facebookHandle: string; youtubeHandle: string; twitterHandle: string;
  maintenanceMode: boolean; maintenanceMessage: string;
  defaultBookingSlotMin: string; reviewAutoApprove: boolean; portfolioAutoApprove: boolean;
};

const GENERAL_FIELDS: (keyof Form)[] = ["businessName", "supportEmail", "supportPhone", "whatsappNumber", "instagramHandle", "facebookHandle", "youtubeHandle", "twitterHandle", "maintenanceMode", "maintenanceMessage"];
const BOOKING_FIELDS: (keyof Form)[] = ["defaultBookingSlotMin", "reviewAutoApprove", "portfolioAutoApprove"];

const inputCls =
  "h-9 w-full rounded border border-gray-200 bg-white px-2.5 text-sm text-gray-900 outline-none transition placeholder:text-gray-300 focus:border-gray-400 focus:ring-2 focus:ring-gray-900/5 disabled:bg-gray-50";
const invalidCls = "border-red-300 focus:border-red-400 focus:ring-red-500/10";

// Turn the API config into the string-based form shape.
function toForm(c: Config): Form {
  return {
    businessName: c.businessName ?? "",
    supportEmail: c.supportEmail ?? "",
    supportPhone: c.supportPhone ?? "",
    whatsappNumber: c.whatsappNumber ?? "",
    instagramHandle: c.instagramHandle ?? "",
    facebookHandle: c.facebookHandle ?? "",
    youtubeHandle: c.youtubeHandle ?? "",
    twitterHandle: c.twitterHandle ?? "",
    maintenanceMode: c.maintenanceMode,
    maintenanceMessage: c.maintenanceMessage ?? "",
    defaultBookingSlotMin: String(c.defaultBookingSlotMin),
    reviewAutoApprove: c.reviewAutoApprove,
    portfolioAutoApprove: c.portfolioAutoApprove,
  };
}

export function SettingsForm() {
  const [form, setForm] = React.useState<Form | null>(null);
  const [baseline, setBaseline] = React.useState<Form | null>(null);
  const [system, setSystem] = React.useState<SystemStatus | null>(null);
  const [loading, setLoading] = React.useState(true);
  const [loadError, setLoadError] = React.useState<string | null>(null);

  const [errors, setErrors] = React.useState<Partial<Record<keyof Form, string>>>({});
  const [saving, setSaving] = React.useState<null | "general" | "booking">(null);
  const [toast, setToast] = React.useState<string | null>(null);

  React.useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(null), 4000);
    return () => clearTimeout(t);
  }, [toast]);

  // Fetch once on mount (async IIFE — the project's effect-fetch pattern).
  React.useEffect(() => {
    let cancelled = false;
    void (async () => {
      setLoading(true);
      setLoadError(null);
      try {
        const res = await fetch(API.admin.settings);
        const json = (await res.json()) as Envelope<{ config: Config; system: SystemStatus }>;
        if (cancelled) return;
        if (res.ok && json.success && json.data) {
          const f = toForm(json.data.config);
          setForm(f);
          setBaseline(f);
          setSystem(json.data.system);
        } else {
          setLoadError(json.message || "Could not load settings");
        }
      } catch {
        if (!cancelled) setLoadError("Could not reach the server. Please try again.");
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, []);

  const set = <K extends keyof Form>(key: K, value: Form[K]) => {
    setForm((f) => (f ? { ...f, [key]: value } : f));
    setErrors((e) => (e[key] ? { ...e, [key]: undefined } : e));
  };

  // A section is dirty when any of its fields differs from the loaded baseline.
  const isDirty = React.useCallback(
    (fields: (keyof Form)[]) => !!form && !!baseline && fields.some((k) => form[k] !== baseline[k]),
    [form, baseline]
  );

  // Save ONE section: PATCH only that section's fields. On 422 the offending fields
  // are flagged and nothing is lost; on success the saved fields are rebaselined so
  // the button disables again. Uses PATCH /api/v1/admin/settings.
  async function save(section: "general" | "booking", fields: (keyof Form)[]) {
    if (!form || saving) return;
    setSaving(section);
    setErrors({});

    const payload: Record<string, unknown> = {};
    for (const k of fields) {
      payload[k] = k === "defaultBookingSlotMin" ? Number(form.defaultBookingSlotMin) : form[k];
    }

    try {
      const res = await fetch(API.admin.settings, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const json = (await res.json()) as Envelope<{ config: Config; system: SystemStatus }>;
      if (!res.ok || !json.success) {
        if (json.errors) {
          const mapped: Partial<Record<keyof Form, string>> = {};
          for (const [k, msgs] of Object.entries(json.errors)) mapped[k as keyof Form] = msgs[0];
          setErrors(mapped);
        } else {
          // 401/403/404/409/500 etc. — show the backend message, keep every input.
          setToast(json.message || "Could not save settings");
        }
        return;
      }
      // Rebaseline the saved section from the authoritative response.
      if (json.data) {
        const fresh = toForm(json.data.config);
        setBaseline((b) => (b ? { ...b, ...Object.fromEntries(fields.map((k) => [k, fresh[k]])) } : fresh));
        setForm((cur) => (cur ? { ...cur, ...Object.fromEntries(fields.map((k) => [k, fresh[k]])) } : cur));
        setSystem(json.data.system);
      }
      setToast("Settings saved");
    } catch {
      setToast("Could not reach the server. Please try again.");
    } finally {
      setSaving(null);
    }
  }

  if (loading) return <SettingsSkeleton />;

  if (loadError || !form || !system) {
    return (
      <div className="flex flex-col items-center justify-center rounded border border-red-100 bg-red-50/50 px-6 py-14 text-center">
        <AlertTriangle className="size-6 text-red-400" aria-hidden="true" />
        <h3 className="mt-3 text-sm font-semibold text-gray-900">Could not load settings</h3>
        <p className="mt-1 text-xs text-gray-500">{loadError ?? "Please try again."}</p>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      {toast && (
        <div role="status" aria-live="polite" className="flex items-center justify-between gap-3 rounded border border-gray-200 bg-white px-3 py-2 shadow-sm">
          <p className="flex items-center gap-2 text-xs text-gray-700"><Check className="size-3.5 shrink-0 text-green-600" aria-hidden="true" />{toast}</p>
          <button type="button" onClick={() => setToast(null)} aria-label="Dismiss" className="rounded p-0.5 text-gray-400 transition hover:bg-gray-100 hover:text-gray-700"><X className="size-3.5" /></button>
        </div>
      )}

      {/* ── GENERAL ─────────────────────────────────────────────────────────── */}
      <Card>
        <CardHeader>
          <CardTitle>General</CardTitle>
          <p className="mt-0.5 text-xs text-gray-500">Business identity, contact and social handles.</p>
        </CardHeader>
        <CardBody className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <TextField label="Business name" required value={form.businessName} error={errors.businessName} disabled={saving === "general"} onChange={(v) => set("businessName", v)} />
            <TextField label="Support email" type="email" value={form.supportEmail} error={errors.supportEmail} disabled={saving === "general"} onChange={(v) => set("supportEmail", v)} />
            <TextField label="Support phone" value={form.supportPhone} disabled={saving === "general"} onChange={(v) => set("supportPhone", v)} />
            <TextField label="WhatsApp number" value={form.whatsappNumber} disabled={saving === "general"} onChange={(v) => set("whatsappNumber", v)} />
            <TextField label="Instagram" value={form.instagramHandle} disabled={saving === "general"} onChange={(v) => set("instagramHandle", v)} />
            <TextField label="Facebook" value={form.facebookHandle} disabled={saving === "general"} onChange={(v) => set("facebookHandle", v)} />
            <TextField label="YouTube" value={form.youtubeHandle} disabled={saving === "general"} onChange={(v) => set("youtubeHandle", v)} />
            <TextField label="Twitter" value={form.twitterHandle} disabled={saving === "general"} onChange={(v) => set("twitterHandle", v)} />
          </div>

          <div className="rounded border border-gray-100 p-3">
            <SwitchRow label="Maintenance mode" hint="Show a maintenance notice to customers." checked={form.maintenanceMode} disabled={saving === "general"} onChange={(v) => set("maintenanceMode", v)} />
            {form.maintenanceMode && (
              <div className="mt-3">
                <TextField label="Maintenance message" value={form.maintenanceMessage} disabled={saving === "general"} onChange={(v) => set("maintenanceMessage", v)} />
              </div>
            )}
          </div>

          <SectionSave onClick={() => save("general", GENERAL_FIELDS)} disabled={!isDirty(GENERAL_FIELDS)} saving={saving === "general"} />
        </CardBody>
      </Card>

      {/* ── BOOKING ─────────────────────────────────────────────────────────── */}
      <Card>
        <CardHeader>
          <CardTitle>Booking</CardTitle>
          <p className="mt-0.5 text-xs text-gray-500">Defaults for scheduling and approvals.</p>
        </CardHeader>
        <CardBody className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <TextField label="Default booking slot (minutes)" type="number" value={form.defaultBookingSlotMin} error={errors.defaultBookingSlotMin} disabled={saving === "booking"} onChange={(v) => set("defaultBookingSlotMin", v)} />
          </div>
          <div className="space-y-2">
            <div className="rounded border border-gray-100 p-3">
              <SwitchRow label="Review auto-approve" hint="Publish customer reviews without manual approval." checked={form.reviewAutoApprove} disabled={saving === "booking"} onChange={(v) => set("reviewAutoApprove", v)} />
            </div>
            <div className="rounded border border-gray-100 p-3">
              <SwitchRow label="Portfolio auto-approve" hint="Approve worker portfolio changes automatically." checked={form.portfolioAutoApprove} disabled={saving === "booking"} onChange={(v) => set("portfolioAutoApprove", v)} />
            </div>
          </div>

          <SectionSave onClick={() => save("booking", BOOKING_FIELDS)} disabled={!isDirty(BOOKING_FIELDS)} saving={saving === "booking"} />
        </CardBody>
      </Card>

      {/* ── SYSTEM (read-only) ──────────────────────────────────────────────── */}
      <Card>
        <CardHeader>
          <CardTitle>System</CardTitle>
          <p className="mt-0.5 text-xs text-gray-500">Read-only platform status.</p>
        </CardHeader>
        <CardBody>
          <dl className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            <ReadOnly label="Current version" value={system.version} />
            <ReadOnly label="Database status" value={system.database} />
            <ReadOnly label="Server status" value={system.server} />
            <ReadOnly label="Environment" value={system.environment} />
            <ReadOnly label="Last updated" value={formatDateTime(system.lastUpdated)} />
          </dl>
        </CardBody>
      </Card>
    </div>
  );
}

function formatDateTime(iso: string): string {
  const ms = Date.parse(iso);
  return Number.isNaN(ms) ? "—" : new Date(ms).toLocaleString("en-IN", { day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit", timeZone: "UTC" });
}

// ── Small building blocks (consistent with the ERP field styling) ────────────
function TextField({
  label, value, onChange, error, type = "text", required, disabled,
}: {
  label: string; value: string; onChange: (v: string) => void;
  error?: string; type?: string; required?: boolean; disabled?: boolean;
}) {
  return (
    <div className="space-y-1">
      <label className="block text-xs font-medium text-gray-700">{label}{required && <span className="ml-0.5 text-red-500" aria-hidden="true">*</span>}</label>
      <input type={type} value={value} onChange={(e) => onChange(e.target.value)} disabled={disabled} aria-invalid={Boolean(error)} className={cn(inputCls, error && invalidCls)} />
      {error && <p role="alert" className="text-[11px] text-red-600">{error}</p>}
    </div>
  );
}

function SwitchRow({
  label, hint, checked, onChange, disabled,
}: {
  label: string; hint?: string; checked: boolean; onChange: (v: boolean) => void; disabled?: boolean;
}) {
  return (
    <div className="flex items-center justify-between gap-3">
      <div className="min-w-0">
        <p className="text-sm font-medium text-gray-800">{label}</p>
        {hint && <p className="text-[11px] text-gray-400">{hint}</p>}
      </div>
      <button
        type="button"
        role="switch"
        aria-checked={checked}
        aria-label={label}
        disabled={disabled}
        onClick={() => onChange(!checked)}
        className={cn(
          "relative inline-flex h-5 w-9 shrink-0 items-center rounded-full border-2 border-transparent transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-gray-900/20 disabled:opacity-50",
          checked ? "bg-gray-900" : "bg-gray-200"
        )}
      >
        <span className={cn("inline-block size-3.5 rounded-full bg-white shadow transition-transform", checked ? "translate-x-3.5" : "translate-x-0.5")} />
      </button>
    </div>
  );
}

function SectionSave({ onClick, disabled, saving }: { onClick: () => void; disabled: boolean; saving: boolean }) {
  return (
    <div className="flex justify-end border-t border-gray-100 pt-4">
      <button
        type="button"
        onClick={onClick}
        disabled={disabled || saving}
        className="inline-flex h-9 items-center gap-1.5 rounded bg-gray-900 px-4 text-sm font-medium text-white transition hover:bg-gray-800 focus:outline-none focus:ring-2 focus:ring-gray-900/20 disabled:cursor-not-allowed disabled:opacity-40"
      >
        {saving && <Loader2 className="size-3.5 animate-spin" aria-hidden="true" />}
        {saving ? "Saving…" : "Save changes"}
      </button>
    </div>
  );
}

function ReadOnly({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded border border-gray-100 p-3">
      <dt className="text-[11px] font-medium uppercase tracking-wide text-gray-400">{label}</dt>
      <dd className="mt-1 text-sm capitalize text-gray-800">{value}</dd>
    </div>
  );
}

// Skeleton mirrors the three-card layout so the page doesn't jump when data lands.
function SettingsSkeleton() {
  return (
    <div className="space-y-5">
      {[8, 3, 5].map((n, i) => (
        <Card key={i}>
          <CardHeader><Skeleton className="h-4 w-28" /></CardHeader>
          <CardBody>
            <div className="grid gap-4 sm:grid-cols-2">
              {Array.from({ length: n }).map((_, j) => <Skeleton key={j} className="h-9 w-full" />)}
            </div>
          </CardBody>
        </Card>
      ))}
    </div>
  );
}
