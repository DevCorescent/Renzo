"use client";

// ============================================================================
// MODULE : Walk-in console — the front desk's single workspace
//
// Flow: Sessions Board → Customer → Booking → Service → Payment → Invoice
//
// The board (stage "sessions") shows today's appointments grouped by status
// and any draft sessions saved in sessionStorage. Clicking a live session
// resumes it at the right step; clicking a draft restores the full pre-booking
// state so the operator can finish and confirm.
//
// Nothing here re-implements pricing, tax, stock or loyalty — each step posts
// to the engine that owns that rule, identical to online bookings.
// ============================================================================

import * as React from "react";
import { useRouter } from "next/navigation";
import {
  Loader2, Search, UserPlus, CalendarPlus, Play, Check, Receipt,
  Wallet, Printer, MessageCircle, Mail, ArrowRight, X, CircleCheck,
  ArrowLeft, LayoutGrid, Clock, PlusCircle, Pencil, RefreshCw,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { API } from "@/lib/endpoints";
import { Card, CardBody, CardHeader, CardTitle } from "@/components/shared/ui";
import { formatMoney, labelise } from "@/lib/operations";

// ── Types ────────────────────────────────────────────────────────────────────

export type WalkInService = { id: string; name: string; price: number; duration: number };
export type WalkInWorker  = { id: string; name: string; employeeCode: string };
export type Customer = {
  id: string; firstName: string; lastName: string | null;
  phone: string | null; email: string | null; totalVisits: number;
};

type LiveSession = {
  id: string;
  appointmentNo: string;
  status: string;
  startTime: string;
  source: string;
  customer: Customer;
  workerId: string | null;
  workerName: string | null;
  serviceNames: string;
  serviceCount: number;
  invoice: {
    id: string; invoiceNo: string;
    totalAmount: number; balanceDue: number; status: string;
  } | null;
};

type DraftSession = {
  id: string;
  savedAt: string;
  customer: Customer;
  serviceIds: string[];
  workerId: string;
  assistantId: string;
  notes: string;
  discount: string;
  chair: string;
  room: string;
  startTime: string;
};

type Stage = "sessions" | "customer" | "booking" | "service" | "billing" | "done";

// ── Stage bar (only shown inside an active flow) ──────────────────────────────

const FLOW_STAGES: { key: Stage; label: string }[] = [
  { key: "customer", label: "Customer" },
  { key: "booking",  label: "Booking"  },
  { key: "service",  label: "Service"  },
  { key: "billing",  label: "Payment"  },
  { key: "done",     label: "Invoice"  },
];

function StageBar({ stage }: { stage: Stage }) {
  const index = FLOW_STAGES.findIndex((s) => s.key === stage);
  return (
    <ol className="flex flex-wrap items-center gap-1.5">
      {FLOW_STAGES.map((s, i) => {
        const done   = i < index;
        const active = i === index;
        return (
          <li key={s.key} className="flex items-center gap-1.5">
            <span className={cn(
              "inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-medium transition",
              done   && "bg-emerald-50 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-300",
              active && "bg-gray-900 text-white dark:bg-white dark:text-gray-900",
              !done && !active && "bg-gray-100 text-gray-400 dark:bg-white/5 dark:text-(--sa-muted)"
            )}>
              {done ? <Check className="size-3" aria-hidden="true" /> : <span>{i + 1}</span>}
              {s.label}
            </span>
            {i < FLOW_STAGES.length - 1 && (
              <ArrowRight className="size-3 text-gray-300 dark:text-(--sa-muted)" aria-hidden="true" />
            )}
          </li>
        );
      })}
    </ol>
  );
}

// ── Draft helpers (sessionStorage — cleared when the tab closes) ──────────────

const DRAFTS_KEY = "renzo-walkin-drafts";

function readDrafts(): DraftSession[] {
  try { return JSON.parse(sessionStorage.getItem(DRAFTS_KEY) ?? "[]"); }
  catch { return []; }
}
function writeDraft(d: DraftSession) {
  const rest = readDrafts().filter((x) => x.id !== d.id);
  sessionStorage.setItem(DRAFTS_KEY, JSON.stringify([d, ...rest]));
}
function removeDraft(id: string) {
  sessionStorage.setItem(DRAFTS_KEY, JSON.stringify(readDrafts().filter((x) => x.id !== id)));
}

// ── Status badge ──────────────────────────────────────────────────────────────

function statusBadge(status: string, invoice: LiveSession["invoice"]) {
  if (status === "STARTED")
    return { label: "In Progress", cls: "bg-blue-50 text-blue-700 dark:bg-blue-500/15 dark:text-blue-300" };
  if (status === "CONFIRMED" || status === "PENDING")
    return { label: "Queued", cls: "bg-amber-50 text-amber-700 dark:bg-amber-500/15 dark:text-amber-300" };
  if (status === "COMPLETED" && !invoice)
    return { label: "Awaiting Bill", cls: "bg-orange-50 text-orange-700 dark:bg-orange-500/15 dark:text-orange-300" };
  if (invoice?.status === "PAID")
    return { label: "Done", cls: "bg-emerald-50 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-300" };
  if (invoice)
    return { label: "Partial Pay", cls: "bg-yellow-50 text-yellow-700 dark:bg-yellow-500/15 dark:text-yellow-300" };
  return { label: status, cls: "bg-gray-100 text-gray-500" };
}

// ── Style tokens ──────────────────────────────────────────────────────────────

const inputCls =
  "h-9 w-full rounded border border-gray-200 bg-white px-2.5 text-sm text-gray-900 outline-none transition focus:border-gray-400 dark:border-(--sa-border) dark:bg-(--sa-surface) dark:text-(--sa-text) dark:focus:border-white/30";
const labelCls = "mb-1 block text-xs font-medium text-gray-600 dark:text-(--sa-text-2)";
const btnPrimary =
  "inline-flex items-center gap-1.5 rounded bg-gray-900 px-3 py-2 text-xs font-medium text-white transition hover:bg-gray-800 disabled:opacity-50 dark:bg-white dark:text-gray-900 dark:hover:bg-white/90";
const btnGhost =
  "inline-flex items-center gap-1.5 rounded border border-gray-200 px-2.5 py-1.5 text-xs text-gray-600 transition hover:bg-gray-50 disabled:opacity-50 dark:border-(--sa-border) dark:text-(--sa-text-2) dark:hover:bg-white/5";

// ── Fetch helper ──────────────────────────────────────────────────────────────

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

// ── Session card ──────────────────────────────────────────────────────────────

function SessionCard({
  session,
  onResume,
  dimmed,
}: {
  session: LiveSession;
  onResume: (s: LiveSession) => void;
  dimmed?: boolean;
}) {
  const badge = statusBadge(session.status, session.invoice);
  return (
    <div className={cn(
      "rounded-lg border p-3 flex flex-col gap-2 transition-shadow",
      dimmed
        ? "border-gray-100 bg-gray-50/60 dark:border-(--sa-border) dark:bg-white/[0.02]"
        : "border-gray-200 bg-white shadow-sm hover:shadow-md dark:border-(--sa-border) dark:bg-(--sa-surface)"
    )}>
      {/* Header row */}
      <div className="flex items-start justify-between gap-1.5">
        <span className={cn("inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-semibold", badge.cls)}>
          {badge.label}
        </span>
        <span className="flex items-center gap-0.5 text-[10px] text-gray-400 dark:text-(--sa-muted)">
          <Clock className="size-2.5" aria-hidden="true" />
          {session.startTime}
        </span>
      </div>

      {/* Customer */}
      <div>
        <p className={cn("text-sm font-medium leading-tight", dimmed ? "text-gray-500 dark:text-(--sa-text-2)" : "text-gray-800 dark:text-(--sa-text)")}>
          {session.customer.firstName} {session.customer.lastName ?? ""}
        </p>
        <p className="text-[11px] text-gray-400 dark:text-(--sa-muted)">{session.customer.phone}</p>
      </div>

      {/* Staff + services */}
      <div className="space-y-0.5">
        {session.workerName && (
          <p className="text-[11px] text-gray-500 dark:text-(--sa-text-2)">
            <span className="text-gray-400">Staff:</span> {session.workerName}
          </p>
        )}
        {session.serviceNames && (
          <p className="text-[11px] text-gray-500 dark:text-(--sa-text-2) line-clamp-2">{session.serviceNames}</p>
        )}
        {session.invoice && (
          <p className="text-[11px] text-gray-500 dark:text-(--sa-text-2)">
            {formatMoney(session.invoice.totalAmount)}
            {session.invoice.balanceDue > 0 && (
              <span className="text-orange-500"> · Due {formatMoney(session.invoice.balanceDue)}</span>
            )}
          </p>
        )}
      </div>

      {/* Action */}
      {!dimmed && (
        <button onClick={() => onResume(session)} className={cn(btnGhost, "mt-auto w-full justify-center text-[11px]")}>
          Continue →
        </button>
      )}
    </div>
  );
}

function SessionGroup({
  title,
  sessions,
  onResume,
  dimmed,
}: {
  title: string;
  sessions: LiveSession[];
  onResume: (s: LiveSession) => void;
  dimmed?: boolean;
}) {
  return (
    <div>
      <h3 className={cn(
        "mb-2 text-xs font-semibold uppercase tracking-wide",
        dimmed ? "text-gray-300 dark:text-white/20" : "text-gray-400 dark:text-(--sa-muted)"
      )}>
        {title} · {sessions.length}
      </h3>
      <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
        {sessions.map((s) => (
          <SessionCard key={s.id} session={s} onResume={onResume} dimmed={dimmed} />
        ))}
      </div>
    </div>
  );
}

// ── Main console ──────────────────────────────────────────────────────────────

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
  billingBasePath: string;
}) {
  const router = useRouter();

  const [stage, setStage] = React.useState<Stage>("sessions");
  const [busy,  setBusy]  = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [note,  setNote]  = React.useState<string | null>(null);

  // ── Sessions board state ──────────────────────────────────────────────────
  const [liveSessions,    setLiveSessions]    = React.useState<LiveSession[]>([]);
  const [localDrafts,     setLocalDrafts]     = React.useState<DraftSession[]>([]);
  const [sessionsLoading, setSessionsLoading] = React.useState(false);

  // ── Customer ──────────────────────────────────────────────────────────────
  const [term,     setTerm]     = React.useState("");
  const [hits,     setHits]     = React.useState<Customer[]>([]);
  const [searching, setSearching] = React.useState(false);
  const [customer, setCustomer] = React.useState<Customer | null>(null);
  const [newName,  setNewName]  = React.useState("");
  const [newPhone, setNewPhone] = React.useState("");
  const [newEmail, setNewEmail] = React.useState("");

  // ── Booking ───────────────────────────────────────────────────────────────
  // Each selected service carries its own assigned worker (empty = any available).
  type ServiceRow = { serviceId: string; workerId: string };
  const [rows,        setRows]        = React.useState<ServiceRow[]>([]);
  const [addSvcId,    setAddSvcId]    = React.useState("");
  const [svcQuery,    setSvcQuery]    = React.useState("");
  const [svcOpen,     setSvcOpen]     = React.useState(false);
  const [assistantId, setAssistantId] = React.useState("");
  const [chair,       setChair]       = React.useState("");
  const [room,        setRoom]        = React.useState("");
  const [startTime,   setStartTime]   = React.useState(() => {
    const d = new Date(Date.now() + 5.5 * 3600_000);
    return `${String(d.getUTCHours()).padStart(2, "0")}:${String(d.getUTCMinutes()).padStart(2, "0")}`;
  });
  const [notes,    setNotes]    = React.useState("");
  const [discount, setDiscount] = React.useState("");

  // ── Step results ──────────────────────────────────────────────────────────
  const [appointment, setAppointment] = React.useState<{ id: string; appointmentNo: string } | null>(null);
  const [invoice,     setInvoice]     = React.useState<{ id: string; invoiceNo: string; totalAmount: number; balanceDue: number; status: string } | null>(null);

  // ── Payment ───────────────────────────────────────────────────────────────
  const [method,    setMethod]    = React.useState("CASH");
  const [amount,    setAmount]    = React.useState("");
  const [reference, setReference] = React.useState("");

  // ── Fetch sessions on board enter ─────────────────────────────────────────
  const fetchSessions = React.useCallback(async () => {
    setSessionsLoading(true);
    try {
      const today = new Date(Date.now() + 5.5 * 3600_000).toISOString().slice(0, 10);
      const res  = await fetch(`/api/v1/branch-admin/sessions?date=${today}`);
      const json = await res.json().catch(() => null);
      if (json?.success) setLiveSessions(json.data as LiveSession[]);
    } finally {
      setSessionsLoading(false);
    }
  }, []);

  React.useEffect(() => {
    if (stage === "sessions") {
      fetchSessions();
      setLocalDrafts(readDrafts());
    }
  }, [stage, fetchSessions]);

  // ── Debounced customer search ─────────────────────────────────────────────
  React.useEffect(() => {
    const q = term.trim();
    if (q.length < 2) return;
    const controller = new AbortController();
    const timer = setTimeout(async () => {
      setSearching(true);
      try {
        const res  = await fetch(`${API.admin.customerSearch}?q=${encodeURIComponent(q)}`, { signal: controller.signal });
        const json = await res.json().catch(() => null);
        if (json?.success) setHits(json.data.items ?? []);
      } catch { /* aborted */ }
      finally { if (!controller.signal.aborted) setSearching(false); }
    }, 250);
    return () => { clearTimeout(timer); controller.abort(); };
  }, [term]);

  const visibleHits  = term.trim().length >= 2 ? hits : [];
  const chosen       = rows.map((r) => services.find((s) => s.id === r.serviceId)).filter(Boolean) as WalkInService[];
  const subtotal     = chosen.reduce((sum, s) => sum + s.price, 0);
  const duration     = chosen.reduce((sum, s) => sum + s.duration, 0);
  const discountVal  = Math.min(Number(discount) || 0, subtotal);
  const taxable      = Math.max(0, subtotal - discountVal);
  const taxValue     = Math.round(((taxable * taxPercent) / 100) * 100) / 100;
  const grandTotal   = Math.round((taxable + taxValue) * 100) / 100;
  // Services not yet in the list (for the "add" dropdown)
  const availableToAdd = services.filter((s) => !rows.find((r) => r.serviceId === s.id));

  // ── Helpers ───────────────────────────────────────────────────────────────
  async function run(label: string, fn: () => Promise<void>) {
    if (busy) return;
    setBusy(true); setError(null); setNote(null);
    try { await fn(); }
    catch (e) { setError(e instanceof Error ? `${label}: ${e.message}` : `${label} failed`); }
    finally   { setBusy(false); }
  }

  function freshTime() {
    const d = new Date(Date.now() + 5.5 * 3600_000);
    return `${String(d.getUTCHours()).padStart(2, "0")}:${String(d.getUTCMinutes()).padStart(2, "0")}`;
  }

  function clearFlow() {
    setTerm(""); setHits([]); setCustomer(null);
    setNewName(""); setNewPhone(""); setNewEmail("");
    setRows([]); setAddSvcId(""); setSvcQuery(""); setSvcOpen(false); setAssistantId("");
    setChair(""); setRoom(""); setNotes(""); setDiscount("");
    setStartTime(freshTime());
    setAppointment(null); setInvoice(null);
    setAmount(""); setReference("");
    setError(null); setNote(null);
  }

  function goToBoard(notification?: string) {
    clearFlow();
    if (notification) setNote(notification);
    setStage("sessions");
  }

  function reset() {
    clearFlow();
    setStage("sessions");
    router.refresh();
  }

  // ── Draft management ──────────────────────────────────────────────────────
  function saveAsDraft() {
    if (!customer) return;
    const draft: DraftSession = {
      id: Math.random().toString(36).slice(2, 10),
      savedAt: new Date().toISOString(),
      customer,
      serviceIds: rows.map((r) => r.serviceId),
      workerId: rows[0]?.workerId ?? "",
      assistantId,
      notes,
      discount,
      chair,
      room,
      startTime,
    };
    writeDraft(draft);
    goToBoard(`Draft saved for ${customer.firstName} — tap to resume.`);
  }

  function resumeDraft(draft: DraftSession) {
    setCustomer(draft.customer);
    // Restore as service rows (serviceWorkers not stored in draft → workerId blank)
    setRows(draft.serviceIds.map((sid) => ({ serviceId: sid, workerId: draft.workerId })));
    setAssistantId(draft.assistantId);
    setNotes(draft.notes);
    setDiscount(draft.discount);
    setChair(draft.chair);
    setRoom(draft.room);
    setStartTime(draft.startTime);
    removeDraft(draft.id);
    setLocalDrafts((prev) => prev.filter((d) => d.id !== draft.id));
    setError(null);
    setNote(`Draft for ${draft.customer.firstName} resumed.`);
    setStage("booking");
  }

  function discardDraft(id: string) {
    removeDraft(id);
    setLocalDrafts((prev) => prev.filter((d) => d.id !== id));
  }

  // ── Resume live session ───────────────────────────────────────────────────
  function resumeLive(session: LiveSession) {
    setCustomer(session.customer);
    setAppointment({ id: session.id, appointmentNo: session.appointmentNo });
    setError(null);
    if (session.invoice) {
      setInvoice(session.invoice);
      setAmount(String(session.invoice.balanceDue));
      setNote(`Resumed ${session.appointmentNo}.`);
      setStage(session.invoice.status === "PAID" ? "done" : "billing");
    } else {
      setNote(`Resumed ${session.appointmentNo}.`);
      setStage("service");
    }
  }

  // ── API actions ───────────────────────────────────────────────────────────
  const createCustomer = () =>
    run("Create customer", async () => {
      const data = await post(API.reception.customers, {
        firstName: newName.trim().split(/\s+/)[0],
        lastName:  newName.trim().split(/\s+/).slice(1).join(" ") || null,
        phone:     newPhone.trim(),
        email:     newEmail.trim() || null,
        entrySource:  "WALK_IN",
        customerType: "WALK_IN",
      });
      setCustomer(data as Customer);
      setStage("booking");
    });

  const book = () =>
    run("Book", async () => {
      const today = new Date(Date.now() + 5.5 * 3600_000).toISOString().slice(0, 10);

      // Build per-service worker map (skip blank entries = "any available").
      const serviceWorkers: Record<string, string> = {};
      rows.forEach((r) => { if (r.workerId) serviceWorkers[r.serviceId] = r.workerId; });
      const hasPerService = Object.keys(serviceWorkers).length > 0;

      // The appointment-level workerId is the first explicitly assigned worker.
      // The qualification check is bypassed by booking-service when serviceWorkers is set.
      const primaryWorkerId = rows.find((r) => r.workerId)?.workerId ?? "";

      const data = await post(API.reception.appointments, {
        customerPhone: customer!.phone,
        customerName:  `${customer!.firstName} ${customer!.lastName ?? ""}`.trim(),
        serviceIds:    rows.map((r) => r.serviceId),
        ...(primaryWorkerId ? { workerId: primaryWorkerId } : {}),
        ...(hasPerService   ? { serviceWorkers }            : {}),
        ...(assistantId     ? { assistantWorkerId: assistantId } : {}),
        ...(chair.trim()    ? { chairCabinNo: chair.trim() }   : {}),
        ...(room.trim()     ? { roomNo: room.trim() }           : {}),
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
      await post(`${API.reception.appointments}/${appointment!.id}/checkin`, {});
      await post(`${API.admin.appointment(appointment!.id)}/status`, { status: "STARTED" }, "PATCH");
      setNote("Service started.");
    });

  const completeAndBill = () =>
    run("Complete & bill", async () => {
      await post(`${API.admin.appointment(appointment!.id)}/status`, { status: "COMPLETED" }, "PATCH");
      const data = await post(API.reception.billing, {
        appointmentId: appointment!.id,
        ...(discountVal > 0 ? { discountAmount: discountVal } : {}),
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
      const res  = await fetch(`${API.reception.billing}?limit=50`);
      const json = await res.json().catch(() => null);
      const fresh = json?.data?.items?.find((i: { id: string }) => i.id === invoice!.id);
      setInvoice((prev) => prev && fresh ? { ...prev, balanceDue: fresh.balanceDue, status: fresh.status } : prev);
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
      "_blank", "noopener,noreferrer"
    );

  // ── SESSIONS BOARD ────────────────────────────────────────────────────────
  if (stage === "sessions") {
    const active      = liveSessions.filter((s) => ["STARTED", "CONFIRMED", "PENDING"].includes(s.status));
    const awaitBill   = liveSessions.filter((s) => s.status === "COMPLETED" && !s.invoice);
    const inPayment   = liveSessions.filter((s) => s.status === "COMPLETED" && s.invoice && s.invoice.status !== "PAID");
    const done        = liveSessions.filter((s) => s.invoice?.status === "PAID");
    const hasAnything = liveSessions.length > 0 || localDrafts.length > 0;

    return (
      <div className="space-y-5">
        {/* Header */}
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h2 className="text-lg font-semibold text-gray-900 dark:text-(--sa-text)">Front Desk</h2>
            <p className="mt-0.5 text-xs text-gray-500 dark:text-(--sa-text-2)">
              {new Date().toLocaleDateString("en-IN", { weekday: "long", day: "numeric", month: "long" })}
              {liveSessions.length > 0 && ` · ${liveSessions.length} session${liveSessions.length !== 1 ? "s" : ""} today`}
            </p>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={fetchSessions}
              disabled={sessionsLoading}
              className={btnGhost}
              title="Refresh"
            >
              <RefreshCw className={cn("size-3.5", sessionsLoading && "animate-spin")} aria-hidden="true" />
              Refresh
            </button>
            <button
              onClick={() => { clearFlow(); setStage("customer"); }}
              className={btnPrimary}
            >
              <PlusCircle className="size-3.5" aria-hidden="true" /> New Session
            </button>
          </div>
        </div>

        {/* Board-level note (e.g. "Draft saved for Priya") */}
        {note && (
          <p className="flex items-start gap-2 rounded border border-green-100 bg-green-50 px-3 py-2 text-xs text-green-700 dark:border-emerald-500/20 dark:bg-emerald-500/10 dark:text-emerald-300">
            <CircleCheck className="mt-0.5 size-3.5 shrink-0" aria-hidden="true" /> {note}
          </p>
        )}

        {/* Loading */}
        {sessionsLoading && !hasAnything && (
          <div className="flex items-center justify-center py-12 text-sm text-gray-400">
            <Loader2 className="mr-2 size-4 animate-spin" aria-hidden="true" />
            Loading today's sessions…
          </div>
        )}

        {/* Empty state */}
        {!sessionsLoading && !hasAnything && (
          <div className="flex flex-col items-center justify-center py-16 text-center">
            <LayoutGrid className="size-10 text-gray-200 dark:text-white/10 mb-3" aria-hidden="true" />
            <p className="text-sm text-gray-500 dark:text-(--sa-text-2)">No sessions today.</p>
            <p className="mt-1 text-xs text-gray-400 dark:text-(--sa-muted)">Tap <strong>New Session</strong> to start a walk-in.</p>
          </div>
        )}

        {/* Local drafts */}
        {localDrafts.length > 0 && (
          <div>
            <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-gray-400 dark:text-(--sa-muted)">
              Drafts · {localDrafts.length}
            </h3>
            <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
              {localDrafts.map((draft) => {
                const svcNames   = draft.serviceIds
                  .map((id) => services.find((s) => s.id === id)?.name)
                  .filter(Boolean)
                  .join(", ");
                const workerName = workers.find((w) => w.id === draft.workerId)?.name;
                const savedTime  = new Date(draft.savedAt).toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" });

                return (
                  <div
                    key={draft.id}
                    className="rounded-lg border border-dashed border-gray-200 bg-white p-3 flex flex-col gap-2 dark:border-(--sa-border) dark:bg-(--sa-surface)"
                  >
                    <div className="flex items-start justify-between gap-1.5">
                      <span className="inline-flex items-center gap-1 rounded-full bg-gray-100 px-2 py-0.5 text-[10px] font-medium text-gray-500 dark:bg-white/5 dark:text-(--sa-muted)">
                        <Pencil className="size-2.5" aria-hidden="true" /> Draft · {savedTime}
                      </span>
                      <button
                        onClick={() => discardDraft(draft.id)}
                        className="text-gray-300 hover:text-red-400 transition-colors"
                        title="Discard draft"
                      >
                        <X className="size-3.5" aria-hidden="true" />
                      </button>
                    </div>

                    <div>
                      <p className="text-sm font-medium text-gray-800 dark:text-(--sa-text) leading-tight">
                        {draft.customer.firstName} {draft.customer.lastName ?? ""}
                      </p>
                      <p className="text-[11px] text-gray-400 dark:text-(--sa-muted)">{draft.customer.phone}</p>
                    </div>

                    <div className="space-y-0.5">
                      {svcNames && <p className="text-[11px] text-gray-500 dark:text-(--sa-text-2) line-clamp-2">{svcNames}</p>}
                      {workerName && <p className="text-[11px] text-gray-400 dark:text-(--sa-muted)">Staff: {workerName}</p>}
                    </div>

                    <button
                      onClick={() => resumeDraft(draft)}
                      className={cn(btnGhost, "mt-auto w-full justify-center text-[11px]")}
                    >
                      Resume →
                    </button>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Live session groups */}
        {active.length > 0 && (
          <SessionGroup title="Active" sessions={active} onResume={resumeLive} />
        )}
        {awaitBill.length > 0 && (
          <SessionGroup title="Awaiting Bill" sessions={awaitBill} onResume={resumeLive} />
        )}
        {inPayment.length > 0 && (
          <SessionGroup title="Pending Payment" sessions={inPayment} onResume={resumeLive} />
        )}
        {done.length > 0 && (
          <SessionGroup title="Done Today" sessions={done} onResume={resumeLive} dimmed />
        )}
      </div>
    );
  }

  // ── ACTIVE FLOW (customer → done) ─────────────────────────────────────────
  return (
    <div className="space-y-4">
      {/* Stage bar + contextual controls */}
      <div className="flex flex-wrap items-center justify-between gap-2">
        <StageBar stage={stage} />

        <div className="flex items-center gap-2">
          {/* Save as draft — only before the appointment hits the DB */}
          {customer && !appointment && (
            <button type="button" onClick={saveAsDraft} className={btnGhost}>
              <Pencil className="size-3.5" aria-hidden="true" /> Save draft
            </button>
          )}
          {/* Back to board — safe to leave any time before the appointment is committed */}
          {!appointment && (
            <button type="button" onClick={() => goToBoard()} className={btnGhost}>
              <ArrowLeft className="size-3.5" aria-hidden="true" /> Board
            </button>
          )}
          {/* Once committed, offer a way back without losing the in-DB booking */}
          {appointment && stage !== "done" && (
            <button type="button" onClick={() => goToBoard()} className={cn(btnGhost, "text-[11px]")}>
              <LayoutGrid className="size-3.5" aria-hidden="true" /> Board (save &amp; exit)
            </button>
          )}
        </div>
      </div>

      {error && (
        <p className="flex items-start gap-2 rounded border border-red-100 bg-red-50 px-3 py-2 text-xs text-red-700 dark:border-red-500/20 dark:bg-red-500/10 dark:text-red-300">
          <X className="mt-0.5 size-3.5 shrink-0" aria-hidden="true" /> {error}
        </p>
      )}
      {note && !error && (
        <p className="flex items-start gap-2 rounded border border-green-100 bg-green-50 px-3 py-2 text-xs text-green-700 dark:border-emerald-500/20 dark:bg-emerald-500/10 dark:text-emerald-300">
          <CircleCheck className="mt-0.5 size-3.5 shrink-0" aria-hidden="true" /> {note}
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
                    <button type="button" onClick={() => setCustomer(null)} className={btnGhost}>Change</button>
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
                    {searching && <Loader2 className="absolute right-2.5 top-1/2 size-3.5 -translate-y-1/2 animate-spin text-gray-400" aria-hidden="true" />}
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

                  <div className="rounded border border-dashed border-gray-200 p-3 dark:border-(--sa-border)">
                    <p className="mb-2 text-xs text-gray-500 dark:text-(--sa-text-2)">
                      Not found? Add them here — name and mobile is all it takes.
                    </p>
                    <div className="grid gap-2 sm:grid-cols-3">
                      <input value={newName}  onChange={(e) => setNewName(e.target.value)}  placeholder="Full name" className={inputCls} />
                      <input value={newPhone} onChange={(e) => setNewPhone(e.target.value)} placeholder="Mobile" inputMode="tel" className={inputCls} />
                      <input value={newEmail} onChange={(e) => setNewEmail(e.target.value)} placeholder="Email (optional)" type="email" className={inputCls} />
                    </div>
                    <button
                      type="button"
                      onClick={createCustomer}
                      disabled={busy || !newName.trim() || !newPhone.trim()}
                      className={cn(btnPrimary, "mt-2")}
                    >
                      {busy ? <Loader2 className="size-3.5 animate-spin" /> : <UserPlus className="size-3.5" />}
                      Create &amp; continue
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

                {/* ── Service rows table ─────────────────────────────────── */}
                {rows.length > 0 && (
                  <div className="overflow-x-auto rounded border border-gray-100 dark:border-(--sa-border)">
                    <table className="w-full text-xs">
                      <thead>
                        <tr className="bg-gray-50 dark:bg-white/5 border-b border-gray-100 dark:border-(--sa-border)">
                          <th className="px-3 py-2 text-left font-medium text-gray-500 dark:text-(--sa-text-2)">Service</th>
                          <th className="px-3 py-2 text-left font-medium text-gray-500 dark:text-(--sa-text-2)">Assigned Staff</th>
                          <th className="px-3 py-2 text-right font-medium text-gray-500 dark:text-(--sa-text-2)">Price</th>
                          {!appointment && <th className="w-8" />}
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-100 dark:divide-white/5">
                        {rows.map((row, i) => {
                          const svc = services.find((s) => s.id === row.serviceId);
                          if (!svc) return null;
                          return (
                            <tr key={i} className="hover:bg-gray-50/50 dark:hover:bg-white/[0.02]">
                              <td className="px-3 py-2 text-gray-800 dark:text-(--sa-text) font-medium">{svc.name}</td>
                              <td className="px-3 py-2">
                                <select
                                  value={row.workerId}
                                  disabled={Boolean(appointment)}
                                  onChange={(e) => setRows((prev) => prev.map((r, idx) => idx === i ? { ...r, workerId: e.target.value } : r))}
                                  className="h-7 w-full rounded border border-gray-200 bg-white px-2 text-xs text-gray-800 outline-none focus:border-gray-400 disabled:opacity-60 dark:border-(--sa-border) dark:bg-(--sa-surface) dark:text-(--sa-text)"
                                >
                                  <option value="">Any available</option>
                                  {workers.map((w) => (
                                    <option key={w.id} value={w.id}>{w.name}</option>
                                  ))}
                                </select>
                              </td>
                              <td className="px-3 py-2 text-right text-gray-700 dark:text-(--sa-text) tabular-nums">
                                {formatMoney(svc.price)}
                              </td>
                              {!appointment && (
                                <td className="px-2 py-2 text-center">
                                  <button
                                    type="button"
                                    onClick={() => setRows((prev) => prev.filter((_, idx) => idx !== i))}
                                    className="text-gray-300 hover:text-red-400 transition-colors"
                                    aria-label="Remove service"
                                  >
                                    <X className="size-3.5" aria-hidden="true" />
                                  </button>
                                </td>
                              )}
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                )}

                {/* ── Add service (searchable combobox) ──────────────────── */}
                {!appointment && (
                  <div className="relative">
                    <div className="relative">
                      <Search className="pointer-events-none absolute left-2.5 top-1/2 size-3.5 -translate-y-1/2 text-gray-400" aria-hidden="true" />
                      <input
                        type="search"
                        value={svcQuery}
                        onChange={(e) => { setSvcQuery(e.target.value); setSvcOpen(true); setAddSvcId(""); }}
                        onFocus={() => setSvcOpen(true)}
                        onBlur={() => setTimeout(() => setSvcOpen(false), 150)}
                        placeholder={availableToAdd.length === 0 ? "All services added" : "Search and add a service…"}
                        disabled={availableToAdd.length === 0}
                        className={cn(inputCls, "pl-8")}
                      />
                    </div>
                    {svcOpen && availableToAdd.length > 0 && (
                      <ul className="absolute z-20 mt-1 max-h-52 w-full overflow-y-auto rounded border border-gray-200 bg-white shadow-lg dark:border-(--sa-border) dark:bg-(--sa-surface)">
                        {availableToAdd
                          .filter((s) => s.name.toLowerCase().includes(svcQuery.toLowerCase()))
                          .map((s) => (
                            <li key={s.id}>
                              <button
                                type="button"
                                onMouseDown={(e) => e.preventDefault()}
                                onClick={() => {
                                  setRows((prev) => [...prev, { serviceId: s.id, workerId: "" }]);
                                  setSvcQuery("");
                                  setSvcOpen(false);
                                  setAddSvcId("");
                                }}
                                className="flex w-full items-center justify-between px-3 py-2 text-left text-xs hover:bg-gray-50 dark:hover:bg-white/5"
                              >
                                <span className="text-gray-800 dark:text-(--sa-text)">{s.name}</span>
                                <span className="ml-4 shrink-0 text-gray-400 dark:text-(--sa-muted)">{formatMoney(s.price)}</span>
                              </button>
                            </li>
                          ))}
                        {availableToAdd.filter((s) => s.name.toLowerCase().includes(svcQuery.toLowerCase())).length === 0 && (
                          <li className="px-3 py-2 text-xs text-gray-400 dark:text-(--sa-muted)">No services match "{svcQuery}"</li>
                        )}
                      </ul>
                    )}
                  </div>
                )}

                {rows.length === 0 && (
                  <p className="text-xs text-gray-400 dark:text-(--sa-muted) py-1">
                    Use the dropdown above to add services, then assign a staff member to each.
                  </p>
                )}

                {/* ── Scheduling & other fields ──────────────────────────── */}
                <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
                  <div>
                    <label className={labelCls} htmlFor="wi-time">Start time</label>
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

                <div className="grid gap-2 sm:grid-cols-2">
                  <div>
                    <label className={labelCls} htmlFor="wi-assistant">General assistant</label>
                    <select id="wi-assistant" value={assistantId} disabled={Boolean(appointment)}
                      onChange={(e) => setAssistantId(e.target.value)} className={inputCls}>
                      <option value="">None</option>
                      {workers.map((w) => (
                        <option key={w.id} value={w.id}>{w.name}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className={labelCls} htmlFor="wi-notes">Notes</label>
                    <input id="wi-notes" value={notes} disabled={Boolean(appointment)}
                      onChange={(e) => setNotes(e.target.value)} className={inputCls}
                      placeholder="Anything the team should know" />
                  </div>
                </div>

                {!appointment && (
                  <div className="flex flex-wrap items-center gap-2">
                    <button type="button" onClick={book}
                      disabled={busy || rows.length === 0} className={btnPrimary}>
                      {busy ? <Loader2 className="size-3.5 animate-spin" /> : <CalendarPlus className="size-3.5" />}
                      Confirm booking
                    </button>
                    <button type="button" onClick={saveAsDraft} disabled={busy || rows.length === 0} className={btnGhost}>
                      <Pencil className="size-3.5" aria-hidden="true" /> Save as draft
                    </button>
                  </div>
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
                  <button type="button" onClick={() => openPdf("THERMAL_80")} className={btnGhost}>80mm</button>
                  <button type="button" onClick={() => openPdf("THERMAL_58")} className={btnGhost}>58mm</button>
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

        {/* ── Running total (sticky) ─────────────────────────────────────── */}
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
                {discountVal > 0 && (
                  <div className="flex justify-between">
                    <dt className="text-gray-500 dark:text-(--sa-text-2)">Discount</dt>
                    <dd className="text-gray-800 dark:text-(--sa-text)">− {formatMoney(discountVal)}</dd>
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
