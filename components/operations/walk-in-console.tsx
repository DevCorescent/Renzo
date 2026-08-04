"use client";

// ============================================================================
// MODULE : Walk-in console — the front desk's single workspace
//
// A customer walks in and leaves with an invoice WITHOUT the operator changing
// page. The console is a stepper over endpoints that already exist and are
// already tested:
//
//   find/create customer  → /admin/customers/search · /reception/customers
//   book                  → /reception/appointments        (lib/booking-service)
//   check in              → /reception/appointments/:id/checkin
//   start / complete      → /admin/appointments/:id/status
//   bill                  → /reception/billing             (lib/billing-service)
//   pay                   → /reception/billing/:id/payment (wallet, gift card, loyalty)
//   invoice / PDF / send  → /reception/billing/:id/pdf · /send
//
// NOTHING here re-implements booking, pricing, tax, stock or loyalty. Each step
// posts to the engine that owns that rule, so a walk-in and an online booking end
// up identical in the database — which is the whole point of the flow.
// ============================================================================

import * as React from "react";
import { useRouter } from "next/navigation";
import {
  Loader2, Search, UserPlus, CalendarPlus, Play, Check, Receipt,
  Wallet, Printer, MessageCircle, Mail, ArrowRight, X, CircleCheck,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { API } from "@/lib/endpoints";
import { Card, CardBody, CardHeader, CardTitle } from "@/components/shared/ui";
import { formatMoney, labelise } from "@/lib/operations";

// ── Types the console works with ────────────────────────────────────────────
export type WalkInService = { id: string; name: string; price: number; duration: number };
export type WalkInWorker = { id: string; name: string; employeeCode: string };
export type Customer = {
  id: string; firstName: string; lastName: string | null;
  phone: string | null; email: string | null; totalVisits: number;
};

type Stage = "customer" | "booking" | "service" | "billing" | "done";

const STAGES: { key: Stage; label: string }[] = [
  { key: "customer", label: "Customer" },
  { key: "booking", label: "Booking" },
  { key: "service", label: "Service" },
  { key: "billing", label: "Payment" },
  { key: "done", label: "Invoice" },
];

const inputCls =
  "h-9 w-full rounded border border-gray-200 bg-white px-2.5 text-sm text-gray-900 outline-none transition focus:border-gray-400 dark:border-(--sa-border) dark:bg-(--sa-surface) dark:text-(--sa-text) dark:focus:border-white/30";
const labelCls = "mb-1 block text-xs font-medium text-gray-600 dark:text-(--sa-text-2)";
const btnPrimary =
  "inline-flex items-center gap-1.5 rounded bg-gray-900 px-3 py-2 text-xs font-medium text-white transition hover:bg-gray-800 disabled:opacity-50 dark:bg-white dark:text-gray-900 dark:hover:bg-white/90";
const btnGhost =
  "inline-flex items-center gap-1.5 rounded border border-gray-200 px-2.5 py-1.5 text-xs text-gray-600 transition hover:bg-gray-50 disabled:opacity-50 dark:border-(--sa-border) dark:text-(--sa-text-2) dark:hover:bg-white/5";

async function post(url: string, body: unknown, method: "POST" | "PATCH" = "POST") {
  const res = await fetch(url, {
    method,
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  const json = await res.json().catch(() => null);
  if (!res.ok || !json?.success) {
    const fields = json?.errors
      ? Object.values(json.errors as Record<string, string[]>).flat().join(" · ")
      : "";
    throw new Error(fields || json?.message || "Something went wrong");
  }
  return json.data;
}

function StageBar({ stage }: { stage: Stage }) {
  const index = STAGES.findIndex((s) => s.key === stage);
  return (
    <ol className="flex flex-wrap items-center gap-1.5">
      {STAGES.map((s, i) => {
        const done = i < index;
        const active = i === index;
        return (
          <li key={s.key} className="flex items-center gap-1.5">
            <span
              className={cn(
                "inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-medium transition",
                done && "bg-emerald-50 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-300",
                active && "bg-gray-900 text-white dark:bg-white dark:text-gray-900",
                !done && !active && "bg-gray-100 text-gray-400 dark:bg-white/5 dark:text-(--sa-muted)"
              )}
            >
              {done ? <Check className="size-3" aria-hidden="true" /> : <span>{i + 1}</span>}
              {s.label}
            </span>
            {i < STAGES.length - 1 && (
              <ArrowRight className="size-3 text-gray-300 dark:text-(--sa-muted)" aria-hidden="true" />
            )}
          </li>
        );
      })}
    </ol>
  );
}

export function WalkInConsole({
  services,
  workers,
  taxPercent,
  taxName,
  billingBasePath,
}: {
  services: WalkInService[];
  workers: WalkInWorker[];
  taxPercent: number;
  taxName: string;
  /** Where "open the full invoice" goes, e.g. "/reception/billing". */
  billingBasePath: string;
}) {
  const router = useRouter();

  const [stage, setStage] = React.useState<Stage>("customer");
  const [busy, setBusy] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [note, setNote] = React.useState<string | null>(null);

  // ── Customer ──────────────────────────────────────────────────────────────
  const [term, setTerm] = React.useState("");
  const [hits, setHits] = React.useState<Customer[]>([]);
  const [searching, setSearching] = React.useState(false);
  const [customer, setCustomer] = React.useState<Customer | null>(null);
  const [newName, setNewName] = React.useState("");
  const [newPhone, setNewPhone] = React.useState("");
  const [newEmail, setNewEmail] = React.useState("");

  // ── Booking ───────────────────────────────────────────────────────────────
  const [picked, setPicked] = React.useState<string[]>([]);
  const [workerId, setWorkerId] = React.useState("");
  const [assistantId, setAssistantId] = React.useState("");
  const [chair, setChair] = React.useState("");
  const [room, setRoom] = React.useState("");
  const [startTime, setStartTime] = React.useState(() => {
    const d = new Date(Date.now() + 5.5 * 3600_000);
    return `${String(d.getUTCHours()).padStart(2, "0")}:${String(d.getUTCMinutes()).padStart(2, "0")}`;
  });
  const [notes, setNotes] = React.useState("");
  const [discount, setDiscount] = React.useState("");

  // ── Result of each step ───────────────────────────────────────────────────
  const [appointment, setAppointment] = React.useState<{ id: string; appointmentNo: string } | null>(null);
  const [invoice, setInvoice] = React.useState<{ id: string; invoiceNo: string; totalAmount: number; balanceDue: number; status: string } | null>(null);

  // ── Payment ───────────────────────────────────────────────────────────────
  const [method, setMethod] = React.useState("CASH");
  const [amount, setAmount] = React.useState("");
  const [reference, setReference] = React.useState("");

  // Debounced customer search over the EXISTING endpoint.
  React.useEffect(() => {
    const q = term.trim();
    if (q.length < 2) return;

    const controller = new AbortController();
    const timer = setTimeout(async () => {
      setSearching(true);
      try {
        const res = await fetch(`${API.admin.customerSearch}?q=${encodeURIComponent(q)}`, {
          signal: controller.signal,
        });
        const json = await res.json().catch(() => null);
        if (json?.success) setHits(json.data.items ?? []);
      } catch {
        // Aborted while typing — expected.
      } finally {
        if (!controller.signal.aborted) setSearching(false);
      }
    }, 250);

    return () => { clearTimeout(timer); controller.abort(); };
  }, [term]);

  const visibleHits = term.trim().length >= 2 ? hits : [];

  const chosen = services.filter((s) => picked.includes(s.id));
  const subtotal = chosen.reduce((sum, s) => sum + s.price, 0);
  const duration = chosen.reduce((sum, s) => sum + s.duration, 0);
  const discountValue = Math.min(Number(discount) || 0, subtotal);
  const taxable = Math.max(0, subtotal - discountValue);
  const taxValue = Math.round(((taxable * taxPercent) / 100) * 100) / 100;
  const grandTotal = Math.round((taxable + taxValue) * 100) / 100;

  /** Every step wraps in this so one error handler serves the whole console. */
  async function run(label: string, fn: () => Promise<void>) {
    if (busy) return;
    setBusy(true);
    setError(null);
    setNote(null);
    try {
      await fn();
    } catch (e) {
      setError(e instanceof Error ? `${label}: ${e.message}` : `${label} failed`);
    } finally {
      setBusy(false);
    }
  }

  function reset() {
    setStage("customer");
    setTerm(""); setHits([]); setCustomer(null);
    setNewName(""); setNewPhone(""); setNewEmail("");
    setPicked([]); setWorkerId(""); setAssistantId(""); setChair(""); setRoom("");
    setNotes(""); setDiscount("");
    setAppointment(null); setInvoice(null);
    setAmount(""); setReference("");
    setError(null); setNote(null);
    router.refresh();
  }

  // ── Actions ───────────────────────────────────────────────────────────────

  const createCustomer = () =>
    run("Create customer", async () => {
      const data = await post(API.reception.customers, {
        firstName: newName.trim().split(/\s+/)[0],
        lastName: newName.trim().split(/\s+/).slice(1).join(" ") || null,
        phone: newPhone.trim(),
        email: newEmail.trim() || null,
        entrySource: "WALK_IN",
        customerType: "WALK_IN",
      });
      setCustomer(data as Customer);
      setStage("booking");
    });

  const book = () =>
    run("Book", async () => {
      const today = new Date(Date.now() + 5.5 * 3600_000).toISOString().slice(0, 10);
      const data = await post(API.reception.appointments, {
        customerPhone: customer!.phone,
        customerName: `${customer!.firstName} ${customer!.lastName ?? ""}`.trim(),
        serviceIds: picked,
        ...(workerId ? { workerId } : {}),
        ...(assistantId ? { assistantWorkerId: assistantId } : {}),
        ...(chair.trim() ? { chairCabinNo: chair.trim() } : {}),
        ...(room.trim() ? { roomNo: room.trim() } : {}),
        appointmentDate: today,
        startTime,
        notes: notes.trim() || null,
      });
      setAppointment({ id: data.id, appointmentNo: data.appointmentNo });
      setStage("service");
      setNote(`Booked ${data.appointmentNo}.`);
    });

  const startService = () =>
    run("Start service", async () => {
      // Check in first — billing requires the customer to have arrived.
      await post(`${API.reception.appointments}/${appointment!.id}/checkin`, {});
      await post(`${API.admin.appointment(appointment!.id)}/status`, { status: "STARTED" }, "PATCH");
      setNote("Service started.");
    });

  const completeAndBill = () =>
    run("Complete & bill", async () => {
      await post(`${API.admin.appointment(appointment!.id)}/status`, { status: "COMPLETED" }, "PATCH");
      const data = await post(API.reception.billing, {
        appointmentId: appointment!.id,
        ...(discountValue > 0 ? { discountAmount: discountValue } : {}),
      });
      setInvoice({
        id: data.id, invoiceNo: data.invoiceNo,
        totalAmount: data.totalAmount, balanceDue: data.balanceDue, status: data.status,
      });
      setAmount(String(data.balanceDue));
      setStage("billing");
      setNote(`Invoice ${data.invoiceNo} generated.`);
    });

  const collect = () =>
    run("Payment", async () => {
      await post(`${API.reception.bill(invoice!.id)}/payment`, {
        method,
        amount: Number(amount),
        ...(reference.trim() ? { reference: reference.trim() } : {}),
      });
      // Re-read so the receipt shows what the SERVER settled, not what we assumed.
      const res = await fetch(`${API.reception.billing}?limit=50`);
      const json = await res.json().catch(() => null);
      const fresh = json?.data?.items?.find((i: { id: string }) => i.id === invoice!.id);
      setInvoice((prev) => (prev && fresh ? { ...prev, balanceDue: fresh.balanceDue, status: fresh.status } : prev));
      setStage("done");
      setNote("Payment collected.");
    });

  const send = (channel: "WHATSAPP" | "EMAIL") =>
    run(channel === "WHATSAPP" ? "WhatsApp" : "Email", async () => {
      const data = await post(`${API.reception.bill(invoice!.id)}/send`, { channel });
      if (channel === "WHATSAPP" && data?.link) {
        window.open(data.link, "_blank", "noopener,noreferrer");
        setNote("WhatsApp opened with the invoice message.");
      } else {
        setNote("Invoice emailed with the PDF attached.");
      }
    });

  const openPdf = (format?: string) =>
    window.open(
      `${API.reception.bill(invoice!.id)}/pdf?inline=true${format ? `&format=${format}` : ""}`,
      "_blank",
      "noopener,noreferrer"
    );

  // ── Render ────────────────────────────────────────────────────────────────
  return (
    <div className="space-y-4">
      <StageBar stage={stage} />

      {error && (
        <p className="flex items-start gap-2 rounded border border-red-100 bg-red-50 px-3 py-2 text-xs text-red-700 dark:border-red-500/20 dark:bg-red-500/10 dark:text-red-300">
          <X className="mt-0.5 size-3.5 shrink-0" aria-hidden="true" />
          {error}
        </p>
      )}
      {note && !error && (
        <p className="flex items-start gap-2 rounded border border-green-100 bg-green-50 px-3 py-2 text-xs text-green-700 dark:border-emerald-500/20 dark:bg-emerald-500/10 dark:text-emerald-300">
          <CircleCheck className="mt-0.5 size-3.5 shrink-0" aria-hidden="true" />
          {note}
        </p>
      )}

      <div className="grid gap-4 lg:grid-cols-[1.6fr_400px]">
        <div className="space-y-4">
          {/* ── 1. CUSTOMER ─────────────────────────────────────────────── */}
          <Card>
            <CardHeader><CardTitle>1 · Customer</CardTitle></CardHeader>
            <CardBody className="space-y-3">
              {customer ? (
                <div className="flex items-center justify-between gap-2 rounded border border-gray-200 bg-gray-50 px-3 py-2 dark:border-(--sa-border) dark:bg-white/5">
                  <span>
                    <span className="block text-sm text-gray-800 dark:text-(--sa-text)">
                      {`${customer.firstName} ${customer.lastName ?? ""}`.trim()}
                    </span>
                    <span className="block text-[11px] text-gray-400 dark:text-(--sa-muted)">
                      {customer.phone} · {customer.totalVisits} visit{customer.totalVisits === 1 ? "" : "s"}
                    </span>
                  </span>
                  {!appointment && (
                    <button type="button" onClick={() => setCustomer(null)} className={btnGhost}>
                      Change
                    </button>
                  )}
                </div>
              ) : (
                <>
                  <div className="relative">
                    <Search className="pointer-events-none absolute left-2.5 top-1/2 size-3.5 -translate-y-1/2 text-gray-400" aria-hidden="true" />
                    <input
                      value={term}
                      onChange={(e) => setTerm(e.target.value)}
                      placeholder="Search by phone or name…"
                      className={cn(inputCls, "pl-8")}
                      autoFocus
                    />
                    {searching && (
                      <Loader2 className="absolute right-2.5 top-1/2 size-3.5 -translate-y-1/2 animate-spin text-gray-400" aria-hidden="true" />
                    )}
                  </div>

                  {visibleHits.length > 0 && (
                    <ul className="max-h-40 divide-y divide-gray-100 overflow-y-auto rounded border border-gray-200 dark:divide-white/5 dark:border-(--sa-border)">
                      {visibleHits.map((h) => (
                        <li key={h.id}>
                          <button
                            type="button"
                            onClick={() => { setCustomer(h); setStage("booking"); }}
                            className="block w-full px-3 py-2 text-left transition hover:bg-gray-50 dark:hover:bg-white/5"
                          >
                            <span className="block text-sm text-gray-800 dark:text-(--sa-text)">
                              {`${h.firstName} ${h.lastName ?? ""}`.trim()}
                            </span>
                            <span className="block text-[11px] text-gray-400 dark:text-(--sa-muted)">
                              {h.phone} · {h.totalVisits} visit{h.totalVisits === 1 ? "" : "s"}
                            </span>
                          </button>
                        </li>
                      ))}
                    </ul>
                  )}

                  {/* No match — create in place rather than sending them elsewhere. */}
                  <div className="rounded border border-dashed border-gray-200 p-3 dark:border-(--sa-border)">
                    <p className="mb-2 text-xs text-gray-500 dark:text-(--sa-text-2)">
                      Not found? Add them here — name and mobile is all it takes.
                    </p>
                    <div className="grid gap-2 sm:grid-cols-3">
                      <input value={newName} onChange={(e) => setNewName(e.target.value)}
                        placeholder="Full name" className={inputCls} />
                      <input value={newPhone} onChange={(e) => setNewPhone(e.target.value)}
                        placeholder="Mobile" inputMode="tel" className={inputCls} />
                      <input value={newEmail} onChange={(e) => setNewEmail(e.target.value)}
                        placeholder="Email (optional)" type="email" className={inputCls} />
                    </div>
                    <button
                      type="button"
                      onClick={createCustomer}
                      disabled={busy || !newName.trim() || !newPhone.trim()}
                      className={cn(btnPrimary, "mt-2")}
                    >
                      {busy ? <Loader2 className="size-3.5 animate-spin" /> : <UserPlus className="size-3.5" />}
                      Create & continue
                    </button>
                  </div>
                </>
              )}
            </CardBody>
          </Card>

          {/* ── 2. BOOKING ──────────────────────────────────────────────── */}
          {customer && (
            <Card>
              <CardHeader><CardTitle>2 · Services &amp; assignment</CardTitle></CardHeader>
              <CardBody className="space-y-3">
                <div>
                  <label className={labelCls}>Services</label>
                  <div className="flex flex-wrap gap-1.5">
                    {services.map((s) => {
                      const on = picked.includes(s.id);
                      return (
                        <button
                          key={s.id}
                          type="button"
                          disabled={Boolean(appointment)}
                          onClick={() =>
                            setPicked((prev) => (on ? prev.filter((x) => x !== s.id) : [...prev, s.id]))
                          }
                          className={cn(
                            "rounded-full border px-2.5 py-1 text-xs transition disabled:opacity-60",
                            on
                              ? "border-gray-900 bg-gray-900 text-white dark:border-white dark:bg-white dark:text-gray-900"
                              : "border-gray-200 text-gray-600 hover:bg-gray-50 dark:border-(--sa-border) dark:text-(--sa-text-2) dark:hover:bg-white/5"
                          )}
                        >
                          {s.name} · {formatMoney(s.price)}
                        </button>
                      );
                    })}
                  </div>
                </div>

                <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
                  <div>
                    <label className={labelCls} htmlFor="wi-worker">Stylist</label>
                    <select id="wi-worker" value={workerId} disabled={Boolean(appointment)}
                      onChange={(e) => setWorkerId(e.target.value)} className={inputCls}>
                      <option value="">Any available</option>
                      {workers.map((w) => <option key={w.id} value={w.id}>{w.name}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className={labelCls} htmlFor="wi-assistant">Assistant</label>
                    <select id="wi-assistant" value={assistantId} disabled={Boolean(appointment)}
                      onChange={(e) => setAssistantId(e.target.value)} className={inputCls}>
                      <option value="">None</option>
                      {workers.filter((w) => w.id !== workerId).map((w) => (
                        <option key={w.id} value={w.id}>{w.name}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className={labelCls} htmlFor="wi-time">Start</label>
                    <input id="wi-time" type="time" value={startTime} disabled={Boolean(appointment)}
                      onChange={(e) => setStartTime(e.target.value)} className={inputCls} />
                  </div>
                  <div>
                    <label className={labelCls} htmlFor="wi-chair">Chair</label>
                    <input id="wi-chair" value={chair} disabled={Boolean(appointment)}
                      onChange={(e) => setChair(e.target.value)} placeholder="e.g. 3" className={inputCls} />
                  </div>
                  <div>
                    <label className={labelCls} htmlFor="wi-room">Room</label>
                    <input id="wi-room" value={room} disabled={Boolean(appointment)}
                      onChange={(e) => setRoom(e.target.value)} placeholder="e.g. Spa 1" className={inputCls} />
                  </div>
                  <div>
                    <label className={labelCls} htmlFor="wi-disc">Discount ₹</label>
                    <input id="wi-disc" type="number" min={0} value={discount} disabled={Boolean(invoice)}
                      onChange={(e) => setDiscount(e.target.value)} placeholder="0" className={inputCls} />
                  </div>
                </div>

                <div>
                  <label className={labelCls} htmlFor="wi-notes">Notes</label>
                  <input id="wi-notes" value={notes} disabled={Boolean(appointment)}
                    onChange={(e) => setNotes(e.target.value)} className={inputCls}
                    placeholder="Anything the stylist should know" />
                </div>

                {!appointment && (
                  <button type="button" onClick={book} disabled={busy || picked.length === 0} className={btnPrimary}>
                    {busy ? <Loader2 className="size-3.5 animate-spin" /> : <CalendarPlus className="size-3.5" />}
                    Save appointment
                  </button>
                )}
              </CardBody>
            </Card>
          )}

          {/* ── 3. SERVICE ──────────────────────────────────────────────── */}
          {appointment && (
            <Card>
              <CardHeader><CardTitle>3 · Service</CardTitle></CardHeader>
              <CardBody className="space-y-3">
                <p className="text-xs text-gray-500 dark:text-(--sa-text-2)">
                  Booking <span className="font-mono text-gray-800 dark:text-(--sa-text)">{appointment.appointmentNo}</span>
                </p>
                <div className="flex flex-wrap gap-2">
                  <button type="button" onClick={startService} disabled={busy || Boolean(invoice)} className={btnGhost}>
                    {busy ? <Loader2 className="size-3.5 animate-spin" /> : <Play className="size-3.5" />}
                    Check in &amp; start
                  </button>
                  <button type="button" onClick={completeAndBill} disabled={busy || Boolean(invoice)} className={btnPrimary}>
                    {busy ? <Loader2 className="size-3.5 animate-spin" /> : <Receipt className="size-3.5" />}
                    Complete &amp; generate bill
                  </button>
                </div>
              </CardBody>
            </Card>
          )}

          {/* ── 4. PAYMENT ──────────────────────────────────────────────── */}
          {invoice && (
            <Card>
              <CardHeader><CardTitle>4 · Payment &amp; invoice</CardTitle></CardHeader>
              <CardBody className="space-y-3">
                <div className="flex flex-wrap items-center justify-between gap-2 rounded border border-gray-100 bg-gray-50 px-3 py-2 dark:border-(--sa-border) dark:bg-white/5">
                  <span className="font-mono text-sm text-gray-800 dark:text-(--sa-text)">{invoice.invoiceNo}</span>
                  <span className="text-xs text-gray-500 dark:text-(--sa-text-2)">
                    Total {formatMoney(invoice.totalAmount)} · Due {formatMoney(invoice.balanceDue)} · {labelise(invoice.status)}
                  </span>
                </div>

                {invoice.balanceDue > 0 && (
                  <div className="grid gap-2 sm:grid-cols-4">
                    <div>
                      <label className={labelCls} htmlFor="wi-method">Method</label>
                      <select id="wi-method" value={method} onChange={(e) => setMethod(e.target.value)} className={inputCls}>
                        {["CASH", "UPI", "CARD", "WALLET", "GIFT_CARD"].map((m) => (
                          <option key={m} value={m}>{labelise(m)}</option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <label className={labelCls} htmlFor="wi-amt">Amount ₹</label>
                      <input id="wi-amt" type="number" min={0} step="0.01" value={amount}
                        onChange={(e) => setAmount(e.target.value)} className={inputCls} />
                    </div>
                    <div className="sm:col-span-2">
                      <label className={labelCls} htmlFor="wi-ref">Reference</label>
                      <input id="wi-ref" value={reference} onChange={(e) => setReference(e.target.value)}
                        className={inputCls} placeholder="UPI ref, last 4 digits…" />
                    </div>
                  </div>
                )}

                <div className="flex flex-wrap gap-2">
                  {invoice.balanceDue > 0 && (
                    <button type="button" onClick={collect} disabled={busy || !amount} className={btnPrimary}>
                      {busy ? <Loader2 className="size-3.5 animate-spin" /> : <Wallet className="size-3.5" />}
                      Collect {amount ? formatMoney(Number(amount)) : "payment"}
                    </button>
                  )}
                  <button type="button" onClick={() => openPdf()} className={btnGhost}>
                    <Printer className="size-3.5" aria-hidden="true" /> Print / preview
                  </button>
                  <button type="button" onClick={() => openPdf("THERMAL_80")} className={btnGhost}>
                    80mm
                  </button>
                  <button type="button" onClick={() => openPdf("THERMAL_58")} className={btnGhost}>
                    58mm
                  </button>
                  <button type="button" onClick={() => send("WHATSAPP")} disabled={busy} className={btnGhost}>
                    <MessageCircle className="size-3.5" aria-hidden="true" /> WhatsApp
                  </button>
                  <button type="button" onClick={() => send("EMAIL")} disabled={busy} className={btnGhost}>
                    <Mail className="size-3.5" aria-hidden="true" /> Email
                  </button>
                </div>

                {stage === "done" && (
                  <div className="flex flex-wrap gap-2 border-t border-gray-100 pt-3 dark:border-(--sa-border)">
                    <button type="button" onClick={reset} className={btnPrimary}>
                      <UserPlus className="size-3.5" aria-hidden="true" /> Next customer
                    </button>
                    <a href={`${billingBasePath}/${invoice.id}`} className={btnGhost}>
                      Open full invoice
                    </a>
                  </div>
                )}
              </CardBody>
            </Card>
          )}
        </div>

        {/* ── Running total ─────────────────────────────────────────────── */}
        <Card className="h-fit lg:sticky lg:top-4">
          <CardHeader><CardTitle>Bill preview</CardTitle></CardHeader>
          <CardBody>
            {chosen.length === 0 ? (
              <p className="py-6 text-center text-xs text-gray-400 dark:text-(--sa-muted)">
                Pick services to see the total.
              </p>
            ) : (
              <dl className="space-y-1 text-xs">
                {chosen.map((s) => (
                  <div key={s.id} className="flex justify-between gap-3">
                    <dt className="text-gray-600 dark:text-(--sa-text-2)">{s.name}</dt>
                    <dd className="text-gray-800 dark:text-(--sa-text)">{formatMoney(s.price)}</dd>
                  </div>
                ))}
                <div className="flex justify-between border-t border-gray-100 pt-1 dark:border-(--sa-border)">
                  <dt className="text-gray-500 dark:text-(--sa-text-2)">Subtotal</dt>
                  <dd className="text-gray-800 dark:text-(--sa-text)">{formatMoney(subtotal)}</dd>
                </div>
                {discountValue > 0 && (
                  <div className="flex justify-between">
                    <dt className="text-gray-500 dark:text-(--sa-text-2)">Discount</dt>
                    <dd className="text-gray-800 dark:text-(--sa-text)">− {formatMoney(discountValue)}</dd>
                  </div>
                )}
                <div className="flex justify-between">
                  <dt className="text-gray-500 dark:text-(--sa-text-2)">{taxName} ({taxPercent}%)</dt>
                  <dd className="text-gray-800 dark:text-(--sa-text)">{formatMoney(taxValue)}</dd>
                </div>
                <div className="flex justify-between border-t border-gray-100 pt-1 text-sm font-semibold dark:border-(--sa-border)">
                  <dt className="text-gray-700 dark:text-(--sa-text)">Total</dt>
                  <dd className="text-gray-900 dark:text-(--sa-text)">{formatMoney(grandTotal)}</dd>
                </div>
                <p className="pt-2 text-[11px] text-gray-400 dark:text-(--sa-muted)">
                  {duration} min · the server recalculates every figure when the bill is raised.
                </p>
              </dl>
            )}
          </CardBody>
        </Card>
      </div>
    </div>
  );
}
