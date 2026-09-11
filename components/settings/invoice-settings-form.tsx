"use client";

// ============================================================================
// MODULE : Branch Invoice Settings
//
// One-time configuration for what every invoice/receipt printed by this branch
// shows. Fields saved here propagate to all PDF and HTML receipts automatically
// — no per-invoice editing needed.
// ============================================================================

import * as React from "react";
import { Loader2, Save } from "lucide-react";
import { API } from "@/lib/endpoints";
import { Card, CardBody, CardHeader, CardTitle } from "@/components/shared/ui";

type InvoiceSettings = {
  invoiceBusinessName: string | null;
  invoiceTagline: string | null;
  invoiceAddress: string | null;
  invoicePhone: string | null;
  invoiceEmail: string | null;
  invoiceWebsite: string | null;
  invoiceFooterNote: string | null;
  taxName: string;
  taxNumber: string | null;
  taxPercent: number;
  invoicePrefix: string;
  printFormat: string;
};

const inputCls =
  "h-9 w-full rounded border border-gray-200 bg-white px-2.5 text-sm text-gray-900 outline-none transition focus:border-gray-400 dark:border-(--sa-border) dark:bg-(--sa-surface) dark:text-(--sa-text) dark:focus:border-white/30";
const labelCls = "mb-1 block text-xs font-medium text-gray-600 dark:text-(--sa-text-2)";
const sectionCls = "text-xs font-semibold uppercase tracking-wider text-gray-400 dark:text-(--sa-muted) mb-3 mt-5 first:mt-0";
const btnPrimary =
  "inline-flex items-center gap-1.5 rounded bg-gray-900 px-3 py-1.5 text-xs font-medium text-white transition hover:bg-gray-800 disabled:opacity-50 dark:bg-white dark:text-gray-900 dark:hover:bg-white/90";
const btnGhost =
  "inline-flex items-center gap-1.5 rounded border border-gray-200 bg-white px-3 py-1.5 text-xs font-medium text-gray-700 transition hover:bg-gray-50 dark:border-(--sa-border) dark:bg-(--sa-surface) dark:text-(--sa-text) dark:hover:bg-(--sa-hover)";

export function InvoiceSettingsForm({
  branchId,
  initial,
}: {
  branchId: string;
  initial: InvoiceSettings;
}) {
  const [form, setForm] = React.useState({
    invoiceBusinessName: initial.invoiceBusinessName ?? "",
    invoiceTagline: initial.invoiceTagline ?? "",
    invoiceAddress: initial.invoiceAddress ?? "",
    invoicePhone: initial.invoicePhone ?? "",
    invoiceEmail: initial.invoiceEmail ?? "",
    invoiceWebsite: initial.invoiceWebsite ?? "",
    invoiceFooterNote: initial.invoiceFooterNote ?? "",
    taxName: initial.taxName ?? "GST",
    taxNumber: initial.taxNumber ?? "",
    taxPercent: String(initial.taxPercent ?? 18),
    invoicePrefix: initial.invoicePrefix ?? "INV",
    printFormat: initial.printFormat ?? "A4",
  });

  const [busy, setBusy] = React.useState(false);
  const [banner, setBanner] = React.useState<{ ok: boolean; msg: string } | null>(null);

  const set = (key: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) =>
    setForm((prev) => ({ ...prev, [key]: e.target.value }));

  async function save(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setBanner(null);
    try {
      const body: Record<string, string | number | null> = {
        invoiceBusinessName: form.invoiceBusinessName.trim() || null,
        invoiceTagline: form.invoiceTagline.trim() || null,
        invoiceAddress: form.invoiceAddress.trim() || null,
        invoicePhone: form.invoicePhone.trim() || null,
        invoiceEmail: form.invoiceEmail.trim() || null,
        invoiceWebsite: form.invoiceWebsite.trim() || null,
        invoiceFooterNote: form.invoiceFooterNote.trim() || null,
        taxName: form.taxName.trim() || "GST",
        taxNumber: form.taxNumber.trim() || null,
        taxPercent: Number(form.taxPercent),
        invoicePrefix: form.invoicePrefix.trim() || "INV",
        printFormat: form.printFormat,
      };

      const res = await fetch(API.admin.branchSettings(branchId), {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const json = await res.json().catch(() => null);
      if (!res.ok || !json?.success) {
        setBanner({ ok: false, msg: json?.message ?? "Could not save settings." });
      } else {
        setBanner({ ok: true, msg: "Invoice settings saved — all new invoices will use these values." });
      }
    } catch {
      setBanner({ ok: false, msg: "Network error — please try again." });
    } finally {
      setBusy(false);
    }
  }

  return (
    <form onSubmit={save} className="space-y-1">
      {banner && (
        <p
          className={
            banner.ok
              ? "rounded border border-green-100 bg-green-50 px-3 py-2 text-xs text-green-700 dark:border-green-500/20 dark:bg-green-500/10 dark:text-green-300"
              : "rounded border border-red-100 bg-red-50 px-3 py-2 text-xs text-red-700 dark:border-red-500/20 dark:bg-red-500/10 dark:text-red-300"
          }
        >
          {banner.msg}
        </p>
      )}

      {/* ── Brand ─────────────────────────────────────────────────── */}
      <p className={sectionCls}>Brand</p>
      <div className="grid gap-3 sm:grid-cols-2">
        <div>
          <label className={labelCls} htmlFor="is-biz-name">Business name on invoice</label>
          <input id="is-biz-name" className={inputCls} value={form.invoiceBusinessName}
            onChange={set("invoiceBusinessName")} maxLength={80}
            placeholder="e.g. Renzo Hair & Beauty Studio" />
          <p className="mt-1 text-[11px] text-gray-400 dark:text-(--sa-muted)">Leave blank to use the branch name.</p>
        </div>
        <div>
          <label className={labelCls} htmlFor="is-tagline">Tagline</label>
          <input id="is-tagline" className={inputCls} value={form.invoiceTagline}
            onChange={set("invoiceTagline")} maxLength={100}
            placeholder="e.g. Hair & Beauty Salon" />
        </div>
      </div>

      {/* ── Contact ───────────────────────────────────────────────── */}
      <p className={sectionCls}>Contact details</p>
      <div>
        <label className={labelCls} htmlFor="is-address">Address</label>
        <input id="is-address" className={inputCls} value={form.invoiceAddress}
          onChange={set("invoiceAddress")} maxLength={200}
          placeholder="e.g. 12 MG Road, Bangalore – 560001" />
      </div>
      <div className="grid gap-3 sm:grid-cols-3">
        <div>
          <label className={labelCls} htmlFor="is-phone">Phone</label>
          <input id="is-phone" type="tel" className={inputCls} value={form.invoicePhone}
            onChange={set("invoicePhone")} maxLength={20}
            placeholder="+91 98765 43210" />
        </div>
        <div>
          <label className={labelCls} htmlFor="is-email">Email</label>
          <input id="is-email" type="email" className={inputCls} value={form.invoiceEmail}
            onChange={set("invoiceEmail")} maxLength={120}
            placeholder="hello@renzosalon.com" />
        </div>
        <div>
          <label className={labelCls} htmlFor="is-website">Website</label>
          <input id="is-website" className={inputCls} value={form.invoiceWebsite}
            onChange={set("invoiceWebsite")} maxLength={120}
            placeholder="renzosalon.com" />
        </div>
      </div>

      {/* ── Tax / GST ─────────────────────────────────────────────── */}
      <p className={sectionCls}>Tax / GST</p>
      <div className="grid gap-3 sm:grid-cols-3">
        <div>
          <label className={labelCls} htmlFor="is-tax-name">Tax label</label>
          <input id="is-tax-name" className={inputCls} value={form.taxName}
            onChange={set("taxName")} maxLength={20}
            placeholder="GST" />
        </div>
        <div>
          <label className={labelCls} htmlFor="is-tax-pct">Tax rate (%)</label>
          <input id="is-tax-pct" type="number" min={0} max={100} step="0.01"
            className={inputCls} value={form.taxPercent}
            onChange={set("taxPercent")} />
        </div>
        <div>
          <label className={labelCls} htmlFor="is-tax-no">GST / tax number</label>
          <input id="is-tax-no" className={inputCls} value={form.taxNumber}
            onChange={set("taxNumber")} maxLength={40}
            placeholder="e.g. 29ABCDE1234F1Z5" />
          <p className="mt-1 text-[11px] text-gray-400 dark:text-(--sa-muted)">Printed on every invoice & receipt.</p>
        </div>
      </div>

      {/* ── Numbering & format ────────────────────────────────────── */}
      <p className={sectionCls}>Numbering & print format</p>
      <div className="grid gap-3 sm:grid-cols-2">
        <div>
          <label className={labelCls} htmlFor="is-prefix">Invoice prefix</label>
          <input id="is-prefix" className={inputCls} value={form.invoicePrefix}
            onChange={set("invoicePrefix")} maxLength={10}
            placeholder="INV" />
          <p className="mt-1 text-[11px] text-gray-400 dark:text-(--sa-muted)">Invoices will be numbered INV-0001, INV-0002 …</p>
        </div>
        <div>
          <label className={labelCls} htmlFor="is-format">Default print format</label>
          <select id="is-format" className={inputCls} value={form.printFormat}
            onChange={set("printFormat")}>
            <option value="A4">A4 (full page)</option>
            <option value="THERMAL_80">Thermal 80 mm</option>
            <option value="THERMAL_58">Thermal 58 mm</option>
          </select>
        </div>
      </div>

      {/* ── Footer note ───────────────────────────────────────────── */}
      <p className={sectionCls}>Footer / closing note</p>
      <div>
        <label className={labelCls} htmlFor="is-footer">Closing message</label>
        <input id="is-footer" className={inputCls} value={form.invoiceFooterNote}
          onChange={set("invoiceFooterNote")} maxLength={120}
          placeholder='e.g. "Thank you for visiting Renzo! See you soon."' />
      </div>

      {/* ── Actions ───────────────────────────────────────────────── */}
      <div className="flex flex-wrap items-center gap-2 border-t border-gray-100 pt-4 dark:border-(--sa-border)">
        <button type="submit" disabled={busy} className={btnPrimary}>
          {busy ? <Loader2 className="size-3.5 animate-spin" /> : <Save className="size-3.5" />}
          {busy ? "Saving…" : "Save invoice settings"}
        </button>
        <p className="text-xs text-gray-400 dark:text-(--sa-muted)">
          Changes apply to all future invoices immediately.
        </p>
      </div>
    </form>
  );
}
