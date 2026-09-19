"use client";

// ============================================================================
// MODULE : Walk-in console — the front desk's single workspace
//
// Flow: Sessions Board → Customer → Booking → Service → Payment → Invoice
//
// The board shows today's appointments grouped by status and any draft
// sessions saved in sessionStorage. Clicking a live session resumes it at the
// right step; clicking a draft restores the full pre-booking state.
//
// Two ways through:
//   • New session — book, check in, serve, then bill (the full desk flow).
//   • Quick bill  — the customer is already at the counter: pick services and
//     one click books the appointment, marks it checked-in → started →
//     completed, raises the invoice and (optionally) collects payment.
//   A normal session can also jump straight to billing from the booking step.
//
// Finish first, tidy later: a visit can be billed and paid with services still
// on "Any available". The record stays editable afterwards — per-service staff
// (who gets the credit in their history and on the Sheet), assistant, chair,
// room and notes — via PATCH …/appointments/:id/details. The board flags visits
// that still need staff, and can be switched to earlier days to fix them.
//
// The step bar is DERIVED from what exists (customer → appointment → invoice →
// balance), never set by hand, so it cannot drift out of sync with the screen.
//
// Nothing here re-implements pricing, tax, stock or loyalty — each step posts
// to the engine that owns that rule, identical to online bookings.
// ============================================================================

import * as React from "react";
import { useRouter } from "next/navigation";
import {
  Loader2, Search, UserPlus, CalendarPlus, Play, Check, Receipt,
  Wallet, Printer, MessageCircle, Mail, X, CircleCheck, CircleAlert,
  ArrowLeft, LayoutGrid, Clock, PlusCircle, Pencil, RefreshCw, Download, Share2,
  Zap, ChevronDown, CalendarClock, ExternalLink,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { API } from "@/lib/endpoints";
import { Card } from "@/components/shared/ui";
import { formatMoney, labelise } from "@/lib/operations";
import {
  ReceiptScaleControl,
  thermalReceiptUrl,
  useReceiptScale,
} from "@/components/operations/receipt-scale";

// ── Types ────────────────────────────────────────────────────────────────────

type PaySplit = { id: string; method: string; amount: string; reference: string };
const newSplit = (): PaySplit => ({ id: Math.random().toString(36).slice(2), method: "CASH", amount: "", reference: "" });

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
  appointmentDate?: string;
  chairCabinNo?: string | null;
  roomNo?: string | null;
  notes?: string | null;
  assistantWorkerId?: string | null;
  source: string;
  customer: Customer;
  workerId: string | null;
  workerName: string | null;
  serviceNames: string;
  serviceCount: number;
  services?: { serviceId: string; workerId: string | null }[];
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
  /** Staff per service. Older drafts only have `workerId` (applied to all). */
  rows?: { serviceId: string; workerId: string }[];
  workerId: string;
  assistantId: string;
  notes: string;
  discount: string;
  chair: string;
  room: string;
  startTime: string;
  appointmentDate?: string;
};

type InvoiceState = { id: string; invoiceNo: string; totalAmount: number; balanceDue: number; status: string };

/** Today's date (YYYY-MM-DD) in IST, matching how bookings are keyed. */
function todayIst(): string {
  return new Date(Date.now() + 5.5 * 3600_000).toISOString().slice(0, 10);
}

/** Current time (HH:MM) in IST. */
function nowIstTime(): string {
  const d = new Date(Date.now() + 5.5 * 3600_000);
  return `${String(d.getUTCHours()).padStart(2, "0")}:${String(d.getUTCMinutes()).padStart(2, "0")}`;
}

/** "2026-09-17" → "Thu, 17 Sept". */
function formatApptDate(key: string): string {
  const d = new Date(`${key}T00:00:00.000Z`);
  return Number.isNaN(d.getTime())
    ? key
    : d.toLocaleDateString("en-IN", { timeZone: "UTC", weekday: "short", day: "numeric", month: "short" });
}

/** Loose service-name match: substring, punctuation-insensitive, or every word. */
function matchesService(name: string, query: string): boolean {
  const q = query.toLowerCase().trim();
  if (!q) return true;
  const n = name.toLowerCase();
  const norm = (v: string) => v.replace(/[^a-z0-9]/gi, "").toLowerCase();
  return n.includes(q) || norm(n).includes(norm(q)) || q.split(/\s+/).every((w) => n.includes(w));
}

const EPSILON = 0.009;
const PAY_METHODS = ["CASH", "UPI", "CARD", "WALLET", "GIFT_CARD"] as const;

// ── Style tokens ──────────────────────────────────────────────────────────────
// The global dark theme INVERTS the neutral ramp (globals.css): bg-white becomes
// the dark surface and gray-900 becomes near-white. So neutral classes already
// flip on their own — adding `dark:bg-white` re-inverts them and the button
// disappears. The console stays in the dashboard's monochrome palette: hierarchy
// comes from filled vs outlined buttons, colour is kept for meaning only (red =
// error, amber = needs attention).

const inputCls =
  "h-10 w-full rounded-md border border-gray-200 bg-white px-3 text-sm text-gray-900 outline-none transition placeholder:text-gray-400 hover:border-gray-300 focus:border-gray-500 focus:ring-2 focus:ring-gray-500/15 disabled:cursor-not-allowed disabled:opacity-60 dark:border-(--sa-border) dark:bg-(--sa-surface) dark:text-(--sa-text) dark:hover:border-white/20 dark:focus:border-white/40 dark:focus:ring-white/10";
const labelCls = "mb-1.5 block text-xs font-medium text-gray-600 dark:text-(--sa-text-2)";

const btnBase =
  "inline-flex h-9 items-center justify-center gap-2 whitespace-nowrap rounded-md px-4 text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gray-400 focus-visible:ring-offset-1 disabled:pointer-events-none disabled:opacity-50";
const btnPrimary = cn(btnBase, "bg-gray-900 text-white shadow-sm hover:bg-gray-700");
const btnSecondary = cn(
  btnBase,
  "border border-gray-200 bg-white text-gray-700 hover:border-gray-300 hover:bg-gray-100 hover:text-gray-900 dark:border-(--sa-border) dark:text-(--sa-text) dark:hover:border-white/20 dark:hover:bg-(--sa-hover)"
);
const btnGhost = cn(btnSecondary, "h-8 px-3 text-xs");
const panelMuted = "rounded-md border border-gray-200 bg-gray-50 dark:border-(--sa-border) dark:bg-white/[0.03]";

// ── Stage bar ─────────────────────────────────────────────────────────────────

type FlowStep = "customer" | "booking" | "service" | "payment" | "done";

const FLOW_STEPS: { key: FlowStep; label: string }[] = [
  { key: "customer", label: "Customer" },
  { key: "booking",  label: "Booking"  },
  { key: "service",  label: "Service"  },
  { key: "payment",  label: "Payment"  },
  { key: "done",     label: "Invoice"  },
];

function StageBar({ step }: { step: FlowStep }) {
  const index = FLOW_STEPS.findIndex((s) => s.key === step);
  return (
    <ol className="flex flex-wrap items-center gap-y-2" aria-label="Progress">
      {FLOW_STEPS.map((s, i) => {
        const complete = i < index || step === "done";
        const active   = !complete && i === index;
        return (
          <li key={s.key} className="flex items-center" aria-current={active ? "step" : undefined}>
            <span className={cn(
              "inline-flex h-8 items-center gap-2 rounded-full border pl-1 pr-3 text-xs font-medium transition-colors",
              complete && "border-gray-200 bg-gray-50 text-gray-700 dark:border-(--sa-border) dark:bg-white/[0.04] dark:text-(--sa-text-2)",
              active   && "border-gray-900 bg-gray-900 text-white shadow-sm",
              !complete && !active && "border-gray-200 bg-white text-gray-400 dark:border-(--sa-border)"
            )}>
              <span className={cn(
                "flex size-6 items-center justify-center rounded-full text-[11px] font-semibold",
                complete && "bg-gray-200 text-gray-800",
                active   && "bg-white text-gray-900",
                !complete && !active && "bg-gray-100 text-gray-500"
              )}>
                {complete ? <Check className="size-3.5" aria-hidden="true" /> : i + 1}
              </span>
              {s.label}
            </span>
            {i < FLOW_STEPS.length - 1 && (
              <span
                className={cn("mx-1.5 h-px w-4 sm:w-6", i < index || step === "done" ? "bg-gray-400 dark:bg-white/30" : "bg-gray-200 dark:bg-(--sa-border)")}
                aria-hidden="true"
              />
            )}
          </li>
        );
      })}
    </ol>
  );
}

// ── Step card ─────────────────────────────────────────────────────────────────

function StepCard({
  n, title, subtitle, state, action, children,
}: {
  n: number;
  title: string;
  subtitle?: React.ReactNode;
  state: "done" | "active";
  action?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <Card className={cn(
      "overflow-hidden rounded-lg transition-shadow",
      state === "active" && "border-gray-300 shadow-sm dark:border-white/15"
    )}>
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-gray-100 px-5 py-3.5 dark:border-(--sa-border)">
        <div className="flex min-w-0 items-center gap-3">
          <span className={cn(
            "flex size-7 shrink-0 items-center justify-center rounded-full text-xs font-semibold",
            state === "done" ? "bg-gray-100 text-gray-700 ring-1 ring-gray-300 dark:ring-white/15" : "bg-gray-900 text-white"
          )}>
            {state === "done" ? <Check className="size-4" aria-hidden="true" /> : n}
          </span>
          <div className="min-w-0">
            <h3 className="text-sm font-semibold text-gray-900 dark:text-(--sa-text)">{title}</h3>
            {subtitle && <p className="text-xs text-gray-500 dark:text-(--sa-text-2)">{subtitle}</p>}
          </div>
        </div>
        {action}
      </div>
      <div className="space-y-4 p-5">{children}</div>
    </Card>
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
    return { label: "In Progress", cls: "bg-gray-900 text-white" };
  if (status === "CHECKED_IN")
    return { label: "Checked In", cls: "bg-gray-200 text-gray-800" };
  if (status === "CONFIRMED" || status === "PENDING")
    return { label: "Queued", cls: "bg-gray-100 text-gray-600" };
  if (status === "COMPLETED" && !invoice)
    return { label: "Awaiting bill", cls: "bg-amber-50 text-amber-700 dark:bg-amber-400/15 dark:text-amber-300" };
  if (invoice?.status === "PAID")
    return { label: "Paid", cls: "bg-gray-100 text-gray-500" };
  if (invoice)
    return { label: "Part paid", cls: "bg-amber-50 text-amber-700 dark:bg-amber-400/15 dark:text-amber-300" };
  return { label: labelise(status), cls: "bg-gray-100 text-gray-500" };
}

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

type PrintFormat = "A4" | "THERMAL_80" | "THERMAL_58";
const PRINT_LABELS: Record<PrintFormat, string> = { A4: "A4", THERMAL_80: "80mm", THERMAL_58: "58mm" };

function SessionCard({
  session,
  onResume,
  dimmed,
  billingBasePath,
  printSize,
}: {
  session: LiveSession;
  onResume: (s: LiveSession) => void;
  dimmed?: boolean;
  billingBasePath?: string;
  printSize?: PrintFormat;
}) {
  const badge = statusBadge(session.status, session.invoice);
  const missingStaff = (session.services ?? []).filter((x) => !x.workerId).length;

  const [receiptScale] = useReceiptScale();

  const invoicePrintUrl = (inv: NonNullable<LiveSession["invoice"]>, fmt: PrintFormat) => {
    if (fmt === "THERMAL_80") return thermalReceiptUrl(inv.id, 80, receiptScale);
    if (fmt === "THERMAL_58") return thermalReceiptUrl(inv.id, 58, receiptScale);
    return `${API.reception.bill(inv.id)}/pdf?inline=true`;
  };

  return (
    <div className={cn(
      "flex flex-col gap-3 rounded-lg border p-4 transition",
      dimmed
        ? "border-gray-100 bg-gray-50 dark:border-(--sa-border) dark:bg-white/[0.02]"
        : "border-gray-200 bg-white shadow-sm hover:border-gray-300 hover:shadow-md dark:border-(--sa-border) dark:bg-(--sa-surface) dark:hover:border-white/20"
    )}>
      <div className="flex items-start justify-between gap-2">
        <span className="flex flex-wrap items-center gap-1.5">
          <span className={cn("inline-flex items-center rounded-full px-2.5 py-0.5 text-[11px] font-semibold", badge.cls)}>
            {badge.label}
          </span>
          {missingStaff > 0 && (
            <span className="inline-flex items-center rounded-full bg-amber-50 px-2.5 py-0.5 text-[11px] font-semibold text-amber-700 dark:bg-amber-400/15 dark:text-amber-300">
              Needs staff
            </span>
          )}
        </span>
        <span className="flex items-center gap-1 text-[11px] text-gray-400 dark:text-(--sa-muted)">
          <Clock className="size-3" aria-hidden="true" />
          {session.startTime}
        </span>
      </div>

      <div>
        <p className={cn("text-sm font-semibold leading-tight", dimmed ? "text-gray-500 dark:text-(--sa-text-2)" : "text-gray-900 dark:text-(--sa-text)")}>
          {session.customer.firstName} {session.customer.lastName ?? ""}
        </p>
        <p className="mt-0.5 text-xs text-gray-400 dark:text-(--sa-muted)">{session.customer.phone}</p>
      </div>

      <div className="space-y-1">
        {session.workerName && (
          <p className="text-xs text-gray-500 dark:text-(--sa-text-2)">
            <span className="text-gray-400">Staff:</span> {session.workerName}
          </p>
        )}
        {session.serviceNames && (
          <p className="line-clamp-2 text-xs text-gray-600 dark:text-(--sa-text-2)">{session.serviceNames}</p>
        )}
        {session.invoice && (
          <p className="text-xs font-medium text-gray-700 dark:text-(--sa-text)">
            {formatMoney(session.invoice.totalAmount)}
            {session.invoice.balanceDue > 0 && (
              <span className="text-amber-700 dark:text-amber-300"> · Due {formatMoney(session.invoice.balanceDue)}</span>
            )}
          </p>
        )}
      </div>

      {!dimmed ? (
        <button type="button" onClick={() => onResume(session)} className={cn(btnGhost, "mt-auto w-full")}>
          Continue <ArrowLeft className="size-3.5 rotate-180" aria-hidden="true" />
        </button>
      ) : session.invoice ? (
        <div className="mt-auto flex gap-2">
          <button
            type="button"
            onClick={() => onResume(session)}
            className={cn(btnGhost, missingStaff > 0 && "border-amber-300 text-amber-700 dark:border-amber-400/30 dark:text-amber-300")}
            title="Edit staff and visit details"
          >
            <Pencil className="size-3.5" aria-hidden="true" /> {missingStaff > 0 ? "Assign staff" : "Edit"}
          </button>
          {billingBasePath && (
            <a href={`${billingBasePath}/${session.invoice.id}`} className={cn(btnGhost, "flex-1")}>
              View invoice
            </a>
          )}
          <button
            type="button"
            onClick={() => window.open(invoicePrintUrl(session.invoice!, printSize ?? "A4"), "_blank", "noopener,noreferrer")}
            className={cn(btnGhost, "px-2.5")}
            aria-label="Print invoice"
            title={`Print (${PRINT_LABELS[printSize ?? "A4"]})`}
          >
            <Printer className="size-3.5" aria-hidden="true" />
          </button>
        </div>
      ) : null}
    </div>
  );
}

function SessionGroup({
  title,
  sessions,
  onResume,
  dimmed,
  billingBasePath,
  printSize,
}: {
  title: string;
  sessions: LiveSession[];
  onResume: (s: LiveSession) => void;
  dimmed?: boolean;
  billingBasePath?: string;
  printSize?: PrintFormat;
}) {
  return (
    <section>
      <h3 className={cn(
        "mb-3 text-xs font-semibold uppercase tracking-wide",
        dimmed ? "text-gray-400 dark:text-(--sa-muted)" : "text-gray-500 dark:text-(--sa-text-2)"
      )}>
        {title} · {sessions.length}
      </h3>
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-4">
        {sessions.map((s) => (
          <SessionCard key={s.id} session={s} onResume={onResume} dimmed={dimmed} billingBasePath={billingBasePath} printSize={printSize} />
        ))}
      </div>
    </section>
  );
}

// ── Main console ──────────────────────────────────────────────────────────────

export function WalkInConsole({
  services,
  workers,
  taxPercent,
  taxName,
  defaultPrintFormat = "A4",
  billingBasePath,
}: {
  services: WalkInService[];
  workers: WalkInWorker[];
  taxPercent: number;
  taxName: string;
  defaultPrintFormat?: PrintFormat;
  billingBasePath: string;
}) {
  const router = useRouter();

  const [view,  setView]  = React.useState<"board" | "flow">("board");
  // Quick bill: the customer is at the counter — book, serve and bill in one go.
  const [quickMode, setQuickMode] = React.useState(false);
  const [busy,  setBusy]  = React.useState(false);
  const [busyLabel, setBusyLabel] = React.useState<string | null>(null);
  const [error, setError] = React.useState<string | null>(null);
  const [note,  setNote]  = React.useState<string | null>(null);
  const [printSize, setPrintSize] = React.useState<PrintFormat>(defaultPrintFormat);

  // ── Sessions board state ──────────────────────────────────────────────────
  const [liveSessions,    setLiveSessions]    = React.useState<LiveSession[]>([]);
  // Which day the board shows — earlier days can be opened to fix their records.
  const [boardDate,       setBoardDate]       = React.useState(todayIst);
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
  const [svcQuery,    setSvcQuery]    = React.useState("");
  const [svcOpen,     setSvcOpen]     = React.useState(false);
  const [assistantId, setAssistantId] = React.useState("");
  const [chair,       setChair]       = React.useState("");
  const [room,        setRoom]        = React.useState("");
  // Defaults to today, but the desk can book ahead (e.g. tomorrow).
  const [apptDate,    setApptDate]    = React.useState(todayIst);
  const [startTime,   setStartTime]   = React.useState(nowIstTime);
  const [notes,    setNotes]    = React.useState("");
  const [discount, setDiscount] = React.useState("");
  const [showMore, setShowMore] = React.useState(false);

  const isFutureBooking = apptDate > todayIst();

  // ── Step results ──────────────────────────────────────────────────────────
  const [appointment, setAppointment] = React.useState<{ id: string; appointmentNo: string } | null>(null);
  // Staff as last saved on the appointment (serviceId → workerId), to spot edits.
  const [savedStaff,  setSavedStaff]  = React.useState<Record<string, string>>({});
  // Visit details as last saved, to spot edits made after booking.
  const [savedDetails, setSavedDetails] = React.useState({ chair: "", room: "", assistantId: "", notes: "" });
  const [apptStatus,  setApptStatus]  = React.useState<string | null>(null);
  const [invoice,     setInvoice]     = React.useState<InvoiceState | null>(null);

  // ── Payment ───────────────────────────────────────────────────────────────
  const [splits, setSplits] = React.useState<PaySplit[]>(() => [newSplit()]);

  // The step is derived from what exists, so the bar always matches the screen.
  const step: FlowStep = !customer
    ? "customer"
    : !appointment
      ? "booking"
      : !invoice
        ? "service"
        : invoice.balanceDue > EPSILON
          ? "payment"
          : "done";

  // ── Fetch sessions on board enter ─────────────────────────────────────────
  const sessionsReq = React.useRef(0);
  const fetchSessions = React.useCallback(async () => {
    const reqId = ++sessionsReq.current;
    setSessionsLoading(true);
    try {
      const res  = await fetch(`/api/v1/branch-admin/sessions?date=${boardDate}`);
      const json = await res.json().catch(() => null);
      // A newer request (another day picked) wins; drop this late answer.
      if (reqId !== sessionsReq.current) return;
      setLiveSessions(json?.success ? (json.data as LiveSession[]) : []);
    } finally {
      if (reqId === sessionsReq.current) setSessionsLoading(false);
    }
  }, [boardDate]);

  // Load the board when it is shown or its day changes. Scheduled rather than
  // run inline so state is not set synchronously during the effect, and so
  // rapid day-paging collapses into one request.
  React.useEffect(() => {
    if (view !== "board") return;
    const timer = setTimeout(() => {
      setLocalDrafts(readDrafts());
      void fetchSessions();
    }, 0);
    return () => clearTimeout(timer);
  }, [view, fetchSessions]);

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
  const availableToAdd = services.filter((s) => !rows.find((r) => r.serviceId === s.id));
  const matchingToAdd  = availableToAdd.filter((s) => matchesService(s.name, svcQuery));
  const moreOpen = showMore;
  const totalSplitAmount = splits.reduce((s, r) => s + (Number(r.amount) || 0), 0);
  const amountInvalid = splits.some(s => s.amount.trim() !== "" && !(Number(s.amount) >= 0));
  // Staff is not required to bill — but until it is set, nobody gets credit.
  const unassignedCount = rows.filter((r) => !r.workerId).length;
  const staffDirty = Boolean(appointment) && rows.some((r) => (savedStaff[r.serviceId] ?? "") !== r.workerId);
  const detailsDirty = Boolean(appointment) && (
    chair !== savedDetails.chair || room !== savedDetails.room ||
    assistantId !== savedDetails.assistantId || notes !== savedDetails.notes
  );
  const recordDirty = staffDirty || detailsDirty;
  const staffHint = unassignedCount > 0
    ? `${unassignedCount === rows.length ? "No service has" : `${unassignedCount} service${unassignedCount === 1 ? " has" : "s have"}`} staff assigned yet — you can bill now and assign them later, from this screen or the board.`
    : null;

  // ── Helpers ───────────────────────────────────────────────────────────────
  async function run(label: string, fn: () => Promise<void>) {
    if (busy) return;
    setBusy(true); setBusyLabel(label); setError(null); setNote(null);
    try { await fn(); }
    catch (e) { setError(e instanceof Error ? `${label}: ${e.message}` : `${label} failed`); }
    finally   { setBusy(false); setBusyLabel(null); }
  }

  function clearFlow() {
    setTerm(""); setHits([]); setCustomer(null);
    setNewName(""); setNewPhone(""); setNewEmail("");
    setRows([]); setSvcQuery(""); setSvcOpen(false); setAssistantId("");
    setChair(""); setRoom(""); setNotes(""); setDiscount(""); setShowMore(false);
    setStartTime(nowIstTime());
    setApptDate(todayIst());
    setAppointment(null); setApptStatus(null); setInvoice(null); setSavedStaff({});
    setSavedDetails({ chair: "", room: "", assistantId: "", notes: "" });
    setSplits([newSplit()]);
    setError(null); setNote(null);
  }

  function startFlow(quick: boolean) {
    clearFlow();
    setQuickMode(quick);
    setView("flow");
  }

  function goToBoard(notification?: string) {
    clearFlow();
    setQuickMode(false);
    if (notification) setNote(notification);
    setView("board");
  }

  function reset() {
    goToBoard();
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
      rows,
      workerId: rows.find((r) => r.workerId)?.workerId ?? "",
      assistantId,
      notes,
      discount,
      chair,
      room,
      startTime,
      appointmentDate: apptDate,
    };
    writeDraft(draft);
    goToBoard(`Draft saved for ${customer.firstName} — tap Resume to continue.`);
  }

  function resumeDraft(draft: DraftSession) {
    clearFlow();
    setQuickMode(false);
    setCustomer(draft.customer);
    setRows(draft.rows ?? draft.serviceIds.map((sid) => ({ serviceId: sid, workerId: draft.workerId })));
    setShowMore(Boolean(draft.chair || draft.room || draft.assistantId || draft.notes));
    setAssistantId(draft.assistantId);
    setNotes(draft.notes);
    setDiscount(draft.discount);
    setChair(draft.chair);
    setRoom(draft.room);
    setStartTime(draft.startTime);
    // A draft dated in the past (saved yesterday for "today") falls back to today.
    setApptDate(draft.appointmentDate && draft.appointmentDate >= todayIst() ? draft.appointmentDate : todayIst());
    removeDraft(draft.id);
    setLocalDrafts((prev) => prev.filter((d) => d.id !== draft.id));
    setNote(`Draft for ${draft.customer.firstName} resumed.`);
    setView("flow");
  }

  function discardDraft(id: string) {
    removeDraft(id);
    setLocalDrafts((prev) => prev.filter((d) => d.id !== id));
  }

  // ── Resume live session ───────────────────────────────────────────────────
  function resumeLive(session: LiveSession) {
    clearFlow();
    setQuickMode(false);
    setCustomer(session.customer);
    setAppointment({ id: session.id, appointmentNo: session.appointmentNo });
    setApptStatus(session.status);
    // Restore what was booked so the services table and bill preview are filled.
    setRows((session.services ?? []).map((s) => ({ serviceId: s.serviceId, workerId: s.workerId ?? "" })));
    setSavedStaff(Object.fromEntries((session.services ?? []).map((s) => [s.serviceId, s.workerId ?? ""])));
    if (session.appointmentDate) setApptDate(session.appointmentDate);
    setStartTime(session.startTime);
    setChair(session.chairCabinNo ?? "");
    setRoom(session.roomNo ?? "");
    setNotes(session.notes ?? "");
    setAssistantId(session.assistantWorkerId ?? "");
    setShowMore(Boolean(session.chairCabinNo || session.roomNo || session.notes || session.assistantWorkerId));
    setSavedDetails({
      chair: session.chairCabinNo ?? "",
      room: session.roomNo ?? "",
      assistantId: session.assistantWorkerId ?? "",
      notes: session.notes ?? "",
    });
    if (session.invoice) {
      setInvoice(session.invoice);
      setSplits([{ ...newSplit(), amount: String(session.invoice.balanceDue) }]);
    }
    setNote(`Resumed ${session.appointmentNo}.`);
    setView("flow");
  }

  // ── Building blocks ───────────────────────────────────────────────────────

  /** `recordingVisit`: billing now — the visit is happening, not a future reservation. */
  async function createAppointment(recordingVisit = false) {
    const serviceWorkers: Record<string, string> = {};
    rows.forEach((r) => { if (r.workerId) serviceWorkers[r.serviceId] = r.workerId; });
    const hasPerService = Object.keys(serviceWorkers).length > 0;
    // The appointment-level workerId is the first explicitly assigned worker.
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
      appointmentDate: apptDate,
      startTime,
      notes: notes.trim() || null,
      ...(recordingVisit && !isFutureBooking ? { recordingVisit: true } : {}),
    });
    const appt = { id: data.id as string, appointmentNo: data.appointmentNo as string };
    const status = (data.status as string | undefined) ?? "CONFIRMED";
    setAppointment(appt);
    setSavedStaff(Object.fromEntries(rows.map((r) => [r.serviceId, r.workerId])));
    setSavedDetails({ chair, room, assistantId, notes });
    setApptStatus(status);
    return { appt, status };
  }

  /**
   * Walk the appointment to COMPLETED. For a same-day visit it passes through
   * check-in and started too, so arrival/service timestamps and reports stay
   * truthful. Those two are best-effort — billing is what matters here.
   */
  async function completeAppointment(apptId: string, status: string | null) {
    if (status === "COMPLETED") return;
    let current = status;
    if (!isFutureBooking) {
      if (!current || ["PENDING", "CONFIRMED", "RESCHEDULED"].includes(current)) {
        const ok = await post(`${API.reception.appointments}/${apptId}/checkin`, {}).then(() => true, () => false);
        if (ok) { current = "CHECKED_IN"; setApptStatus(current); }
      }
      if (current !== "STARTED") {
        const ok = await post(`${API.admin.appointment(apptId)}/status`, { status: "STARTED" }, "PATCH").then(() => true, () => false);
        if (ok) { current = "STARTED"; setApptStatus(current); }
      }
    }
    await post(`${API.admin.appointment(apptId)}/status`, { status: "COMPLETED" }, "PATCH");
    setApptStatus("COMPLETED");
  }

  /** Save changed staff (null = unassign) and visit details. Returns false if nothing to send. */
  async function persistRecord(apptId: string): Promise<boolean> {
    const assignments = staffDirty
      ? rows
          .filter((r) => (savedStaff[r.serviceId] ?? "") !== r.workerId)
          .map((r) => ({ serviceId: r.serviceId, workerId: r.workerId || null }))
      : [];
    const details = detailsDirty
      ? { chairCabinNo: chair, roomNo: room, notes, assistantWorkerId: assistantId || null }
      : undefined;
    if (assignments.length === 0 && !details) return false;
    await post(
      API.reception.appointmentDetails(apptId),
      { ...(assignments.length ? { assignments } : {}), ...(details ? { details } : {}) },
      "PATCH"
    );
    setSavedStaff(Object.fromEntries(rows.map((r) => [r.serviceId, r.workerId])));
    setSavedDetails({ chair, room, assistantId, notes });
    return true;
  }

  async function raiseInvoice(apptId: string): Promise<InvoiceState> {
    const data = await post(API.reception.billing, {
      appointmentId: apptId,
      ...(discountVal > 0 ? { discountAmount: discountVal } : {}),
    });
    const inv: InvoiceState = {
      id: data.id, invoiceNo: data.invoiceNo,
      totalAmount: data.totalAmount, balanceDue: data.balanceDue, status: data.status,
    };
    setInvoice(inv);
    return inv;
  }

  async function collectSplits(inv: InvoiceState, effectiveSplits?: PaySplit[]): Promise<InvoiceState> {
    const toProcess = (effectiveSplits ?? splits).filter(s => Number(s.amount) > 0);
    let cur = inv;
    for (const split of toProcess) {
      const amt = Math.round(Number(split.amount) * 100) / 100;
      const data = await post(`${API.reception.bill(cur.id)}/payment`, {
        method: split.method,
        amount: amt,
        ...(split.reference.trim() ? { reference: split.reference.trim() } : {}),
      });
      const fresh = data?.invoice;
      cur = fresh
        ? { ...cur, balanceDue: Number(fresh.balanceDue), status: fresh.status, totalAmount: Number(fresh.totalAmount ?? cur.totalAmount) }
        : { ...cur, balanceDue: Math.max(0, cur.balanceDue - amt), status: cur.balanceDue - amt <= EPSILON ? "PAID" : "PARTIAL" };
    }
    setInvoice(cur);
    setSplits([{ ...newSplit(), amount: cur.balanceDue > EPSILON ? String(cur.balanceDue) : "" }]);
    return cur;
  }

  function paymentNote(inv: InvoiceState) {
    return inv.balanceDue > EPSILON
      ? `Part payment recorded — ${formatMoney(inv.balanceDue)} still due on ${inv.invoiceNo}.`
      : `Paid in full — ${inv.invoiceNo} is settled.`;
  }

  // ── Actions ───────────────────────────────────────────────────────────────

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
    });

  const book = () =>
    run("Book", async () => {
      const { appt } = await createAppointment();
      setNote(
        isFutureBooking
          ? `Booked ${appt.appointmentNo} for ${formatApptDate(apptDate)} at ${startTime}. It will show on the board that day — until then it is under Appointments.`
          : `Booked ${appt.appointmentNo}. Check the customer in when they are ready, or bill straight away.`
      );
    });

  /**
   * Straight to the bill: books the appointment if it is not booked yet, walks
   * it to completed, raises the invoice, and — when `collectNow` — takes the
   * payment too. Each piece is committed as it goes, so if a later step fails
   * the screen stays on the step that failed and the button retries from there.
   */
  const generateBill = (collectNow: boolean) =>
    run("Generate bill", async () => {
      let apptId = appointment?.id;
      let status = apptStatus;
      if (!apptId) {
        const created = await createAppointment(true);
        apptId = created.appt.id;
        status = created.status;
      } else if (recordDirty) {
        await persistRecord(apptId);
      }
      await completeAppointment(apptId, status);
      let inv = invoice ?? (await raiseInvoice(apptId));

      if (collectNow) {
        const effective = splits.some(s => Number(s.amount) > 0)
          ? splits
          : [{ ...splits[0], amount: String(inv.balanceDue) }];
        const pay = effective.reduce((s, r) => s + (Number(r.amount) || 0), 0);
        if (pay > EPSILON) {
          inv = await collectSplits(inv, effective);
          setNote(`Invoice ${inv.invoiceNo} generated. ${paymentNote(inv)}`);
          return;
        }
      }
      setSplits([{ ...newSplit(), amount: String(inv.balanceDue) }]);
      setNote(`Invoice ${inv.invoiceNo} generated for ${formatMoney(inv.totalAmount)}. Collect the payment below.`);
    });

  const saveRecord = () =>
    run("Save changes", async () => {
      const sent = await persistRecord(appointment!.id);
      if (!sent) return;
      setNote(
        staffDirty
          ? "Changes saved — the work now shows in each person's history and on the Sheet."
          : "Visit details saved."
      );
    });

  function undoRecord() {
    setRows((prev) => prev.map((r) => ({ ...r, workerId: savedStaff[r.serviceId] ?? "" })));
    setChair(savedDetails.chair);
    setRoom(savedDetails.room);
    setAssistantId(savedDetails.assistantId);
    setNotes(savedDetails.notes);
  }

  const startService = () =>
    run("Start service", async () => {
      if (!apptStatus || ["PENDING", "CONFIRMED", "RESCHEDULED"].includes(apptStatus)) {
        await post(`${API.reception.appointments}/${appointment!.id}/checkin`, {});
      }
      await post(`${API.admin.appointment(appointment!.id)}/status`, { status: "STARTED" }, "PATCH");
      setApptStatus("STARTED");
      setNote("Service started.");
    });

  const collect = () =>
    run("Payment", async () => {
      const next = await collectSplits(invoice!);
      setNote(paymentNote(next));
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

  const [receiptScale] = useReceiptScale();

  const printUrl = (fmt: PrintFormat) => {
    const billId = invoice!.id;
    if (fmt === "THERMAL_80") return thermalReceiptUrl(billId, 80, receiptScale);
    if (fmt === "THERMAL_58") return thermalReceiptUrl(billId, 58, receiptScale);
    return `${API.reception.bill(billId)}/pdf?inline=true`;
  };

  const openPdf = (fmt?: PrintFormat) =>
    window.open(printUrl(fmt ?? printSize), "_blank", "noopener,noreferrer");

  const downloadPdf = () => {
    // A4 PDF download only (thermal is HTML, not a saveable PDF).
    const a = document.createElement("a");
    a.href = `${API.reception.bill(invoice!.id)}/pdf`;
    a.download = "";
    a.click();
  };

  const [copied, setCopied] = React.useState(false);
  const copyLink = async () => {
    const url = `${window.location.origin}${API.reception.bill(invoice!.id)}/pdf?inline=true`;
    await navigator.clipboard.writeText(url);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const spinner = <Loader2 className="size-4 animate-spin" aria-hidden="true" />;

  // Chair / room / assistant / notes — collapsible while booking, and still
  // editable once the visit is booked, billed or paid.
  const detailsBlock = (
    <div className="rounded-md border border-gray-200 dark:border-(--sa-border)">
      <button
        type="button"
        onClick={() => setShowMore((v) => !v)}
        aria-expanded={moreOpen}
        className="flex w-full items-center justify-between rounded-md px-4 py-2.5 text-sm font-medium text-gray-700 transition hover:bg-gray-50 dark:text-(--sa-text-2) dark:hover:bg-white/5"
      >
        {appointment ? "Visit details" : "More details"}
        <span className="flex items-center gap-2 text-xs font-normal text-gray-400">
          Chair, room, assistant, notes
          <ChevronDown className={cn("size-4 transition-transform", moreOpen && "rotate-180")} aria-hidden="true" />
        </span>
      </button>
      {moreOpen && (
        <div className="grid gap-4 border-t border-gray-200 p-4 sm:grid-cols-2 dark:border-(--sa-border)">
          <div>
            <label className={labelCls} htmlFor="wi-chair">Chair</label>
            <input id="wi-chair" value={chair} onChange={(e) => setChair(e.target.value)} placeholder="e.g. 3" className={inputCls} />
          </div>
          <div>
            <label className={labelCls} htmlFor="wi-room">Room</label>
            <input id="wi-room" value={room} onChange={(e) => setRoom(e.target.value)} placeholder="e.g. Spa 1" className={inputCls} />
          </div>
          <div>
            <label className={labelCls} htmlFor="wi-assistant">General assistant</label>
            <select id="wi-assistant" value={assistantId} onChange={(e) => setAssistantId(e.target.value)} className={inputCls}>
              <option value="">None</option>
              {workers.map((w) => (
                <option key={w.id} value={w.id}>{w.name}</option>
              ))}
            </select>
          </div>
          <div>
            <label className={labelCls} htmlFor="wi-notes">Notes</label>
            <input id="wi-notes" value={notes} onChange={(e) => setNotes(e.target.value)}
              className={inputCls} placeholder="Anything the team should know" />
          </div>
        </div>
      )}
    </div>
  );


  // ── SESSIONS BOARD ────────────────────────────────────────────────────────
  if (view === "board") {
    const active      = liveSessions.filter((s) => ["STARTED", "CHECKED_IN", "CONFIRMED", "PENDING"].includes(s.status) && !s.invoice);
    const awaitBill   = liveSessions.filter((s) => s.status === "COMPLETED" && !s.invoice);
    const inPayment   = liveSessions.filter((s) => s.invoice && s.invoice.status !== "PAID");
    const done        = liveSessions.filter((s) => s.invoice?.status === "PAID");
    const hasAnything = liveSessions.length > 0 || localDrafts.length > 0;
    const isToday = boardDate === todayIst();
    const needsStaff = liveSessions.filter((s) => (s.services ?? []).some((x) => !x.workerId)).length;
    const shiftDay = (days: number) => {
      const d = new Date(`${boardDate}T00:00:00.000Z`);
      d.setUTCDate(d.getUTCDate() + days);
      setBoardDate(d.toISOString().slice(0, 10));
    };

    return (
      <div className="space-y-6">
        <div className="flex flex-wrap items-center justify-between gap-4 rounded-lg border border-gray-200 bg-white px-5 py-4 dark:border-(--sa-border) dark:bg-(--sa-surface)">
          <div>
            <h2 className="text-lg font-semibold text-gray-900 dark:text-(--sa-text)">Front Desk</h2>
            <p className="mt-0.5 text-sm text-gray-500 dark:text-(--sa-text-2)">
              {new Date(`${boardDate}T00:00:00.000Z`).toLocaleDateString("en-IN", { timeZone: "UTC", weekday: "long", day: "numeric", month: "long" })}
              {liveSessions.length > 0 && ` · ${liveSessions.length} session${liveSessions.length !== 1 ? "s" : ""}`}
              {needsStaff > 0 && (
                <span className="text-amber-600 dark:text-amber-400"> · {needsStaff} need{needsStaff === 1 ? "s" : ""} staff</span>
              )}
            </p>
            <div className="mt-2 flex flex-wrap items-center gap-1.5">
              <button type="button" onClick={() => shiftDay(-1)} className={cn(btnGhost, "px-2")} aria-label="Previous day" title="Previous day">
                <ArrowLeft className="size-3.5" aria-hidden="true" />
              </button>
              <input
                type="date"
                value={boardDate}
                max={todayIst()}
                onChange={(e) => e.target.value && setBoardDate(e.target.value)}
                aria-label="Board date"
                className={cn(inputCls, "h-8 w-auto text-xs")}
              />
              <button
                type="button"
                onClick={() => shiftDay(1)}
                disabled={isToday}
                className={cn(btnGhost, "px-2")}
                aria-label="Next day"
                title="Next day"
              >
                <ArrowLeft className="size-3.5 rotate-180" aria-hidden="true" />
              </button>
              {!isToday && (
                <button type="button" onClick={() => setBoardDate(todayIst())} className={btnGhost}>Today</button>
              )}
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <button type="button" onClick={() => void fetchSessions()} disabled={sessionsLoading} className={btnSecondary} title="Refresh">
              <RefreshCw className={cn("size-4", sessionsLoading && "animate-spin")} aria-hidden="true" />
              Refresh
            </button>
            <button
              type="button"
              onClick={() => startFlow(true)}
              className={btnSecondary}
              title="Customer is at the counter — pick services and bill in one step"
            >
              <Zap className="size-4" aria-hidden="true" /> Quick bill
            </button>
            <button type="button" onClick={() => startFlow(false)} className={btnPrimary}>
              <PlusCircle className="size-4" aria-hidden="true" /> New session
            </button>
          </div>
        </div>

        {note && (
          <p className={cn(panelMuted, "flex items-start gap-2 rounded-lg px-4 py-3 text-sm text-gray-700 dark:text-(--sa-text)")}>
            <CircleCheck className="mt-0.5 size-4 shrink-0" aria-hidden="true" /> {note}
          </p>
        )}

        {sessionsLoading && !hasAnything && (
          <div className="flex items-center justify-center py-12 text-sm text-gray-400">
            <Loader2 className="mr-2 size-4 animate-spin" aria-hidden="true" />
            Loading today&apos;s sessions…
          </div>
        )}

        {!sessionsLoading && !hasAnything && (
          <div className="flex flex-col items-center justify-center rounded-lg border border-dashed border-gray-200 py-16 text-center dark:border-(--sa-border)">
            <LayoutGrid className="mb-3 size-10 text-gray-300 dark:text-white/15" aria-hidden="true" />
            <p className="text-sm font-medium text-gray-600 dark:text-(--sa-text-2)">
              {isToday ? "No sessions today yet." : "No sessions on this day."}
            </p>
            <p className="mt-1 max-w-sm text-xs text-gray-400 dark:text-(--sa-muted)">
              Use <strong>New session</strong> to book a walk-in, or <strong>Quick bill</strong> to bill a customer straight away.
            </p>
          </div>
        )}

        {localDrafts.length > 0 && (
          <section>
            <h3 className="mb-3 text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-(--sa-text-2)">
              Drafts · {localDrafts.length}
            </h3>
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-4">
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
                    className="flex flex-col gap-3 rounded-lg border border-dashed border-gray-300 bg-white p-4 transition hover:border-gray-400 dark:border-(--sa-border) dark:bg-(--sa-surface) dark:hover:border-white/25"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <span className="inline-flex items-center gap-1 rounded-full bg-gray-100 px-2.5 py-0.5 text-[11px] font-medium text-gray-600 dark:text-(--sa-text-2)">
                        <Pencil className="size-3" aria-hidden="true" /> Draft · {savedTime}
                      </span>
                      <button
                        type="button"
                        onClick={() => discardDraft(draft.id)}
                        className="inline-flex size-7 items-center justify-center rounded-md text-gray-400 transition hover:bg-red-50 hover:text-red-600 dark:hover:bg-red-500/10 dark:hover:text-red-400"
                        title="Discard draft"
                        aria-label="Discard draft"
                      >
                        <X className="size-4" aria-hidden="true" />
                      </button>
                    </div>

                    <div>
                      <p className="text-sm font-semibold leading-tight text-gray-900 dark:text-(--sa-text)">
                        {draft.customer.firstName} {draft.customer.lastName ?? ""}
                      </p>
                      <p className="mt-0.5 text-xs text-gray-400 dark:text-(--sa-muted)">{draft.customer.phone}</p>
                    </div>

                    <div className="space-y-1">
                      {svcNames && <p className="line-clamp-2 text-xs text-gray-600 dark:text-(--sa-text-2)">{svcNames}</p>}
                      {workerName && <p className="text-xs text-gray-400 dark:text-(--sa-muted)">Staff: {workerName}</p>}
                      {draft.appointmentDate && draft.appointmentDate > todayIst() && (
                        <p className="text-xs font-medium text-gray-600 dark:text-(--sa-text-2)">For {formatApptDate(draft.appointmentDate)}</p>
                      )}
                    </div>

                    <button type="button" onClick={() => resumeDraft(draft)} className={cn(btnGhost, "mt-auto w-full")}>
                      Resume <ArrowLeft className="size-3.5 rotate-180" aria-hidden="true" />
                    </button>
                  </div>
                );
              })}
            </div>
          </section>
        )}

        {active.length > 0 && <SessionGroup title="Active" sessions={active} onResume={resumeLive} />}
        {awaitBill.length > 0 && <SessionGroup title="Awaiting Bill" sessions={awaitBill} onResume={resumeLive} />}
        {inPayment.length > 0 && <SessionGroup title="Pending Payment" sessions={inPayment} onResume={resumeLive} />}
        {done.length > 0 && (
          <SessionGroup title={isToday ? "Done Today" : "Done"} sessions={done} onResume={resumeLive} dimmed billingBasePath={billingBasePath} printSize={printSize} />
        )}
      </div>
    );
  }

  // ── ACTIVE FLOW ───────────────────────────────────────────────────────────
  const customerName = customer ? `${customer.firstName} ${customer.lastName ?? ""}`.trim() : "";
  const initials = customerName.split(/\s+/).map((p) => p[0]).join("").slice(0, 2).toUpperCase();
  const paidSoFar = invoice ? Math.max(0, invoice.totalAmount - invoice.balanceDue) : 0;
  const payLabel = totalSplitAmount > 0 ? formatMoney(totalSplitAmount) : formatMoney(grandTotal);

  return (
    <div className="space-y-5">
      {/* Top bar: back · progress · draft */}
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-gray-200 bg-white px-4 py-3 dark:border-(--sa-border) dark:bg-(--sa-surface)">
        <div className="flex flex-wrap items-center gap-3">
          {/* Safe at every stage: before booking nothing is saved yet, and once
              booked the session stays on the board to resume later. */}
          <button
            type="button"
            onClick={() => (step === "done" ? reset() : goToBoard())}
            title={appointment && step !== "done" ? "Progress is saved — resume it from the board" : undefined}
            className={btnSecondary}
          >
            <ArrowLeft className="size-4" aria-hidden="true" /> Back to board
          </button>
          {quickMode && (
            <span className="inline-flex h-7 items-center gap-1.5 rounded-full border border-gray-200 bg-gray-50 px-3 text-xs font-semibold text-gray-700 dark:border-(--sa-border) dark:bg-white/[0.04] dark:text-(--sa-text)">
              <Zap className="size-3.5" aria-hidden="true" /> Quick bill
            </span>
          )}
        </div>
        <StageBar step={step} />
      </div>

      {error && (
        <div role="alert" className="flex items-start justify-between gap-3 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700 dark:border-red-500/20 dark:bg-red-500/10 dark:text-red-300">
          <p className="flex items-start gap-2"><CircleAlert className="mt-0.5 size-4 shrink-0" aria-hidden="true" /> {error}</p>
          <button type="button" onClick={() => setError(null)} aria-label="Dismiss" className="rounded p-0.5 transition hover:bg-red-100 dark:hover:bg-red-500/20">
            <X className="size-4" aria-hidden="true" />
          </button>
        </div>
      )}
      {note && !error && (
        <div role="status" className={cn(panelMuted, "flex items-start justify-between gap-3 rounded-lg px-4 py-3 text-sm text-gray-700 dark:text-(--sa-text)")}>
          <p className="flex items-start gap-2"><CircleCheck className="mt-0.5 size-4 shrink-0" aria-hidden="true" /> {note}</p>
          <button type="button" onClick={() => setNote(null)} aria-label="Dismiss" className="rounded p-0.5 text-gray-400 transition hover:bg-gray-200 hover:text-gray-700 dark:hover:bg-white/10">
            <X className="size-4" aria-hidden="true" />
          </button>
        </div>
      )}

      <div className="grid items-start gap-5 xl:grid-cols-[minmax(0,1fr)_22rem]">
        <div className="min-w-0 space-y-5">

          {/* ── 1. CUSTOMER ─────────────────────────────────────────────── */}
          <StepCard
            n={1}
            title="Customer"
            subtitle={customer ? undefined : "Search an existing customer or add a new one."}
            state={customer ? "done" : "active"}
          >
            {customer ? (
              <div className="flex flex-wrap items-center justify-between gap-3 rounded-md border border-gray-200 bg-gray-50 px-4 py-3 dark:border-(--sa-border) dark:bg-white/5">
                <div className="flex items-center gap-3">
                  <span className="flex size-9 items-center justify-center rounded-full bg-gray-900 text-xs font-semibold text-white">
                    {initials || "?"}
                  </span>
                  <span>
                    <span className="block text-sm font-semibold text-gray-900 dark:text-(--sa-text)">{customerName}</span>
                    <span className="block text-xs text-gray-500 dark:text-(--sa-muted)">
                      {customer.phone} · {customer.totalVisits} visit{customer.totalVisits === 1 ? "" : "s"}
                    </span>
                  </span>
                </div>
                {!appointment && (
                  <button type="button" onClick={() => setCustomer(null)} className={btnGhost}>Change</button>
                )}
              </div>
            ) : (
              <>
                <div className="relative">
                  <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-gray-400" aria-hidden="true" />
                  <input
                    value={term}
                    onChange={(e) => setTerm(e.target.value)}
                    placeholder="Search by phone or name…"
                    aria-label="Search customers"
                    className={cn(inputCls, "pl-9")}
                    autoFocus
                  />
                  {searching && <Loader2 className="absolute right-3 top-1/2 size-4 -translate-y-1/2 animate-spin text-gray-400" aria-hidden="true" />}
                </div>

                {visibleHits.length > 0 && (
                  <ul className="max-h-56 divide-y divide-gray-100 overflow-y-auto rounded-md border border-gray-200 dark:divide-white/5 dark:border-(--sa-border)">
                    {visibleHits.map((h) => (
                      <li key={h.id}>
                        <button
                          type="button"
                          onClick={() => setCustomer(h)}
                          className="flex w-full items-center justify-between gap-3 px-4 py-2.5 text-left transition hover:bg-gray-100 dark:hover:bg-(--sa-hover)"
                        >
                          <span>
                            <span className="block text-sm font-medium text-gray-900 dark:text-(--sa-text)">
                              {`${h.firstName} ${h.lastName ?? ""}`.trim()}
                            </span>
                            <span className="block text-xs text-gray-500 dark:text-(--sa-muted)">
                              {h.phone} · {h.totalVisits} visit{h.totalVisits === 1 ? "" : "s"}
                            </span>
                          </span>
                          <span className="text-xs font-medium text-gray-400">Select</span>
                        </button>
                      </li>
                    ))}
                  </ul>
                )}

                <div className="rounded-md border border-dashed border-gray-300 p-4 dark:border-(--sa-border)">
                  <p className="mb-3 text-sm font-medium text-gray-700 dark:text-(--sa-text)">
                    New customer <span className="font-normal text-gray-400">— name and mobile is all it takes</span>
                  </p>
                  <div className="grid gap-3 sm:grid-cols-3">
                    <input value={newName}  onChange={(e) => setNewName(e.target.value)}  placeholder="Full name" aria-label="Full name" className={inputCls} />
                    <input value={newPhone} onChange={(e) => setNewPhone(e.target.value)} placeholder="Mobile" aria-label="Mobile" inputMode="tel" className={inputCls} />
                    <input value={newEmail} onChange={(e) => setNewEmail(e.target.value)} placeholder="Email (optional)" aria-label="Email" type="email" className={inputCls} />
                  </div>
                  <div className="mt-3 flex justify-end">
                    <button
                      type="button"
                      onClick={createCustomer}
                      disabled={busy || !newName.trim() || !newPhone.trim()}
                      className={btnPrimary}
                    >
                      {busy ? spinner : <UserPlus className="size-4" aria-hidden="true" />}
                      Create &amp; continue
                    </button>
                  </div>
                </div>
              </>
            )}
          </StepCard>

          {/* ── 2. SERVICES & BOOKING ───────────────────────────────────── */}
          {customer && (
            <StepCard
              n={2}
              title={quickMode ? "Services & bill" : "Services & booking"}
              subtitle={
                appointment
                  ? <>Booked as <span className="font-mono">{appointment.appointmentNo}</span> · {formatApptDate(apptDate)} at {startTime} · staff and details stay editable</>
                  : quickMode
                    ? "Add what the customer had — one click books, completes and bills it."
                    : "Add services and assign staff, then book or bill straight away."
              }
              state={appointment ? "done" : "active"}
              action={
                !appointment && customer ? (
                  <button type="button" onClick={saveAsDraft} disabled={busy} className={btnGhost}>
                    <Pencil className="size-3.5" aria-hidden="true" /> Save draft
                  </button>
                ) : undefined
              }
            >
              {rows.length > 1 && (
                <div className="flex flex-wrap items-center gap-2">
                  <label htmlFor="wi-assign-all" className="text-xs font-medium text-gray-600 dark:text-(--sa-text-2)">
                    Assign all services to
                  </label>
                  <select
                    id="wi-assign-all"
                    value=""
                    onChange={(e) => {
                      const workerId = e.target.value;
                      if (workerId) setRows((prev) => prev.map((r) => ({ ...r, workerId })));
                    }}
                    className={cn(inputCls, "h-8 w-auto min-w-44 text-xs")}
                  >
                    <option value="">Choose staff…</option>
                    {workers.map((w) => (
                      <option key={w.id} value={w.id}>{w.name}</option>
                    ))}
                  </select>
                </div>
              )}

              {rows.length > 0 && (
                <div className="overflow-x-auto rounded-md border border-gray-200 dark:border-(--sa-border)">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-gray-200 bg-gray-50 dark:border-(--sa-border) dark:bg-white/5">
                        <th className="px-4 py-2.5 text-left text-xs font-medium text-gray-500 dark:text-(--sa-text-2)">Service</th>
                        <th className="px-4 py-2.5 text-left text-xs font-medium text-gray-500 dark:text-(--sa-text-2)">Assigned staff</th>
                        <th className="px-4 py-2.5 text-right text-xs font-medium text-gray-500 dark:text-(--sa-text-2)">Price</th>
                        {!appointment && <th className="w-12" />}
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100 dark:divide-white/5">
                      {rows.map((row, i) => {
                        const svc = services.find((s) => s.id === row.serviceId);
                        if (!svc) return null;
                        return (
                          <tr key={row.serviceId} className="transition hover:bg-gray-50 dark:hover:bg-white/[0.03]">
                            <td className="px-4 py-2.5">
                              <span className="block font-medium text-gray-900 dark:text-(--sa-text)">{svc.name}</span>
                              <span className="block text-xs text-gray-400 dark:text-(--sa-muted)">{svc.duration} min</span>
                            </td>
                            <td className="px-4 py-2.5">
                              <select
                                value={row.workerId}
                                onChange={(e) => setRows((prev) => prev.map((r, idx) => idx === i ? { ...r, workerId: e.target.value } : r))}
                                aria-label={`Staff for ${svc.name}`}
                                className={cn(
                                  inputCls,
                                  "h-9 min-w-40",
                                  !row.workerId && (appointment || quickMode) &&
                                    "border-amber-400 dark:border-amber-400/60"
                                )}
                              >
                                <option value="">{appointment ? "Not assigned" : "Any available"}</option>
                                {workers.map((w) => (
                                  <option key={w.id} value={w.id}>{w.name}</option>
                                ))}
                              </select>
                            </td>
                            <td className="px-4 py-2.5 text-right font-medium tabular-nums text-gray-900 dark:text-(--sa-text)">
                              {formatMoney(svc.price)}
                            </td>
                            {!appointment && (
                              <td className="px-2 py-2.5 text-center">
                                <button
                                  type="button"
                                  onClick={() => setRows((prev) => prev.filter((_, idx) => idx !== i))}
                                  className="inline-flex size-8 items-center justify-center rounded-md text-gray-400 transition hover:bg-red-50 hover:text-red-600 dark:hover:bg-red-500/10 dark:hover:text-red-400"
                                  aria-label={`Remove ${svc.name}`}
                                  title="Remove"
                                >
                                  <X className="size-4" aria-hidden="true" />
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

              {appointment && (
                <>
                  {staffHint && !recordDirty && (
                    <p className="flex items-start gap-2 text-xs text-amber-700 dark:text-amber-300">
                      <CircleAlert className="mt-0.5 size-3.5 shrink-0" aria-hidden="true" />
                      {unassignedCount === rows.length ? "No service has" : `${unassignedCount} service${unassignedCount === 1 ? " has" : "s have"}`} staff
                      assigned — pick them above and save, so the work is credited.
                    </p>
                  )}
                  {detailsBlock}
                </>
              )}

              {appointment && recordDirty && (
                <div className="sticky bottom-3 z-10 flex flex-wrap items-center justify-between gap-3 rounded-md border border-amber-300 bg-amber-50 px-4 py-3 shadow-sm dark:border-amber-400/30 dark:bg-[#2a2310]">
                  <p className="text-sm text-amber-800 dark:text-amber-300">
                    {invoice
                      ? "Unsaved changes to this visit's record."
                      : "Unsaved changes — they will be saved when you bill, or save them now."}
                  </p>
                  <div className="flex gap-2">
                    <button type="button" onClick={undoRecord} disabled={busy} className={btnGhost}>
                      Undo
                    </button>
                    <button type="button" onClick={saveRecord} disabled={busy} className={cn(btnPrimary, "h-8 px-3 text-xs")}>
                      {busy ? spinner : <Check className="size-3.5" aria-hidden="true" />} Save changes
                    </button>
                  </div>
                </div>
              )}

              {!appointment && (
                <>
                  {/* Searchable service picker */}
                  <div className="relative">
                    <div className="relative">
                      <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-gray-400" aria-hidden="true" />
                      <input
                        type="text"
                        value={svcQuery}
                        onChange={(e) => { setSvcQuery(e.target.value); setSvcOpen(true); }}
                        onFocus={() => setSvcOpen(true)}
                        onBlur={() => setTimeout(() => setSvcOpen(false), 150)}
                        onKeyDown={(e) => { if (e.key === "Escape") setSvcOpen(false); }}
                        placeholder={availableToAdd.length === 0 ? "All services added" : "Search and add a service…"}
                        aria-label="Add a service"
                        disabled={availableToAdd.length === 0}
                        className={cn(inputCls, "pl-9")}
                      />
                    </div>
                    {svcOpen && availableToAdd.length > 0 && (
                      <ul className="absolute z-20 mt-1 max-h-64 w-full overflow-y-auto rounded-md border border-gray-200 bg-white py-1 shadow-lg dark:border-(--sa-border) dark:bg-(--sa-elevated)">
                        {matchingToAdd.map((s) => (
                          <li key={s.id}>
                            <button
                              type="button"
                              onMouseDown={(e) => e.preventDefault()}
                              onClick={() => {
                                setRows((prev) => [...prev, { serviceId: s.id, workerId: "" }]);
                                setSvcQuery("");
                                setSvcOpen(false);
                              }}
                              className="flex w-full items-center justify-between gap-4 px-4 py-2.5 text-left text-sm transition hover:bg-gray-100 dark:hover:bg-(--sa-hover)"
                            >
                              <span className="text-gray-900 dark:text-(--sa-text)">{s.name}</span>
                              <span className="shrink-0 text-xs text-gray-500 dark:text-(--sa-muted)">
                                {s.duration} min · <span className="font-medium text-gray-700 dark:text-(--sa-text-2)">{formatMoney(s.price)}</span>
                              </span>
                            </button>
                          </li>
                        ))}
                        {matchingToAdd.length === 0 && (
                          <li className="px-4 py-2.5 text-sm text-gray-400 dark:text-(--sa-muted)">No services match &ldquo;{svcQuery}&rdquo;</li>
                        )}
                      </ul>
                    )}
                  </div>

                  {rows.length === 0 && (
                    <p className="rounded-md bg-gray-50 px-4 py-3 text-sm text-gray-500 dark:bg-white/5 dark:text-(--sa-muted)">
                      Search above to add services, then assign a staff member to each.
                    </p>
                  )}

                  {/* Scheduling */}
                  <div className={cn("grid gap-4", quickMode ? "sm:grid-cols-2" : "sm:grid-cols-3")}>
                    {!quickMode && (
                      <div>
                        <label className={labelCls} htmlFor="wi-date">Date</label>
                        <input id="wi-date" type="date" value={apptDate} min={todayIst()} required
                          onChange={(e) => setApptDate(e.target.value || todayIst())} className={inputCls} />
                        {isFutureBooking && (
                          <p className="mt-1.5 flex items-center gap-1 text-xs font-medium text-gray-600 dark:text-(--sa-text-2)">
                            <CalendarClock className="size-3.5" aria-hidden="true" /> Advance booking · {formatApptDate(apptDate)}
                          </p>
                        )}
                      </div>
                    )}
                    <div>
                      <label className={labelCls} htmlFor="wi-time">Start time</label>
                      <input id="wi-time" type="time" value={startTime}
                        onChange={(e) => setStartTime(e.target.value)} className={inputCls} />
                    </div>
                    <div>
                      <label className={labelCls} htmlFor="wi-disc">Discount (₹)</label>
                      <input id="wi-disc" type="number" min={0} value={discount}
                        onChange={(e) => setDiscount(e.target.value)} placeholder="0" className={inputCls} />
                    </div>
                  </div>

                  {detailsBlock}

                  {/* Quick bill: take the payment in the same click */}
                  {quickMode && rows.length > 0 && (
                    <div className={cn(panelMuted, "p-4")}>
                      <p className="mb-3 flex items-center gap-2 text-sm font-semibold text-gray-900 dark:text-(--sa-text)">
                        <Wallet className="size-4" aria-hidden="true" /> Payment
                      </p>
                      <div className="space-y-2">
                        {splits.map((split, i) => (
                          <div key={split.id} className="grid gap-2 grid-cols-[1fr_1fr_1fr_auto] items-end">
                            <div>
                              {i === 0 && <label className={labelCls}>Method</label>}
                              <select value={split.method} onChange={(e) => setSplits(prev => prev.map((s, idx) => idx === i ? { ...s, method: e.target.value } : s))} className={inputCls}>
                                {PAY_METHODS.map((m) => <option key={m} value={m}>{labelise(m)}</option>)}
                              </select>
                            </div>
                            <div>
                              {i === 0 && <label className={labelCls}>Amount (₹)</label>}
                              <input type="number" min={0} step="0.01" value={split.amount}
                                onChange={(e) => setSplits(prev => prev.map((s, idx) => idx === i ? { ...s, amount: e.target.value } : s))}
                                className={inputCls} placeholder={i === 0 && splits.length === 1 ? `Full · ${formatMoney(grandTotal)}` : "Amount"} />
                            </div>
                            <div>
                              {i === 0 && <label className={labelCls}>Reference</label>}
                              <input value={split.reference}
                                onChange={(e) => setSplits(prev => prev.map((s, idx) => idx === i ? { ...s, reference: e.target.value } : s))}
                                className={inputCls} placeholder="UPI ref, last 4…" />
                            </div>
                            <div className={i === 0 ? "self-end" : ""}>
                              {splits.length > 1 ? (
                                <button type="button" onClick={() => setSplits(prev => prev.filter((_, idx) => idx !== i))}
                                  className="inline-flex size-9 items-center justify-center rounded text-gray-400 hover:bg-red-50 hover:text-red-500 dark:hover:bg-red-500/10">
                                  <X className="size-4" />
                                </button>
                              ) : <div className="size-9" />}
                            </div>
                          </div>
                        ))}
                      </div>
                      <div className="mt-2 flex items-center justify-between gap-2">
                        <button type="button" onClick={() => setSplits(prev => [...prev, newSplit()])} className={cn(btnGhost, "text-xs")}>
                          <PlusCircle className="size-3.5" /> Add payment method
                        </button>
                        {splits.length > 1 && totalSplitAmount > 0 && (
                          <span className="text-xs text-gray-500 dark:text-(--sa-muted)">
                            Total: {formatMoney(totalSplitAmount)}
                          </span>
                        )}
                      </div>
                      {splits.length === 1 && (
                        <p className="mt-1 text-xs text-gray-500 dark:text-(--sa-muted)">
                          Leave amount blank to collect the full bill. Add more rows for split payment.
                        </p>
                      )}
                    </div>
                  )}

                  {isFutureBooking && (
                    <p className={cn(panelMuted, "flex items-start gap-2 px-4 py-3 text-xs text-gray-600 dark:text-(--sa-text-2)")}>
                      Billing an advance booking now marks it completed straight away, and only one bill is allowed per
                      appointment. If services may change, book it now and bill on the day.
                    </p>
                  )}

                  {rows.length > 0 && staffHint && (
                    <p className="flex items-start gap-2 text-xs text-amber-700 dark:text-amber-300">
                      <CircleAlert className="mt-0.5 size-3.5 shrink-0" aria-hidden="true" />
                      {staffHint}
                    </p>
                  )}

                  {/* Actions */}
                  <div className="flex flex-col-reverse gap-2 border-t border-gray-100 pt-4 sm:flex-row sm:items-center sm:justify-end dark:border-(--sa-border)">
                    {quickMode ? (
                      <>
                        <button type="button" onClick={() => generateBill(false)} disabled={busy || rows.length === 0} className={btnSecondary}>
                          <Receipt className="size-4" aria-hidden="true" /> Bill now, collect later
                        </button>
                        <button type="button" onClick={() => generateBill(true)} disabled={busy || rows.length === 0 || amountInvalid} className={btnPrimary}>
                          {busy ? spinner : <Zap className="size-4" aria-hidden="true" />}
                          {busy && busyLabel ? "Working…" : `Generate bill & collect ${payLabel}`}
                        </button>
                      </>
                    ) : (
                      <>
                        <button
                          type="button"
                          onClick={() => generateBill(false)}
                          disabled={busy || rows.length === 0}
                          className={btnSecondary}
                          title="Book, mark served and raise the invoice in one step"
                        >
                          <Receipt className="size-4" aria-hidden="true" />
                          {isFutureBooking ? "Book & bill in advance" : "Generate bill now"}
                        </button>
                        <button type="button" onClick={book} disabled={busy || rows.length === 0 || !apptDate} className={btnPrimary}>
                          {busy ? spinner : <CalendarPlus className="size-4" aria-hidden="true" />}
                          {isFutureBooking ? `Book for ${formatApptDate(apptDate)}` : "Confirm booking"}
                        </button>
                      </>
                    )}
                  </div>
                </>
              )}
            </StepCard>
          )}

          {/* ── 3. SERVICE ──────────────────────────────────────────────── */}
          {appointment && (
            <StepCard
              n={3}
              title="Service"
              subtitle={invoice ? <>Completed and billed as <span className="font-mono">{invoice.invoiceNo}</span></> : "Check the customer in, then complete and bill."}
              state={invoice ? "done" : "active"}
            >
              {!invoice ? (
                <>
                  <div className="flex flex-wrap items-center gap-2 text-sm">
                    <span className="rounded-md bg-gray-100 px-2.5 py-1 font-mono text-xs text-gray-700 dark:text-(--sa-text)">
                      {appointment.appointmentNo}
                    </span>
                    {apptStatus && (
                      <span className={cn("rounded-full px-2.5 py-0.5 text-xs font-semibold", statusBadge(apptStatus, null).cls)}>
                        {statusBadge(apptStatus, null).label}
                      </span>
                    )}
                    <span className="text-xs text-gray-500 dark:text-(--sa-text-2)">
                      {formatApptDate(apptDate)} · {startTime}
                    </span>
                  </div>

                  {isFutureBooking && (
                    <p className={cn(panelMuted, "flex items-start gap-2 px-4 py-3 text-xs text-gray-600 dark:text-(--sa-text-2)")}>
                      This is an advance booking. Generating the bill now marks it completed, and only one bill is allowed per
                      appointment. If services may change, go back to the board and bill on the day instead.
                    </p>
                  )}

                  <div className="max-w-48">
                    <label className={labelCls} htmlFor="wi-disc2">Discount (₹)</label>
                    <input id="wi-disc2" type="number" min={0} value={discount}
                      onChange={(e) => setDiscount(e.target.value)} placeholder="0" className={inputCls} />
                  </div>

                  <div className="flex flex-col gap-2 border-t border-gray-100 pt-4 sm:flex-row sm:justify-end dark:border-(--sa-border)">
                    {!isFutureBooking && apptStatus !== "STARTED" && apptStatus !== "COMPLETED" && (
                      <button type="button" onClick={startService} disabled={busy} className={btnSecondary}>
                        {busy ? spinner : <Play className="size-4" aria-hidden="true" />}
                        Check in &amp; start
                      </button>
                    )}
                    <button type="button" onClick={() => generateBill(false)} disabled={busy} className={btnPrimary}>
                      {busy ? spinner : <Receipt className="size-4" aria-hidden="true" />}
                      {isFutureBooking ? "Generate bill now" : <>Complete &amp; generate bill</>}
                    </button>
                  </div>
                </>
              ) : (
                <p className="text-sm text-gray-600 dark:text-(--sa-text-2)">
                  Service marked completed. Payment and invoice are below.
                </p>
              )}
            </StepCard>
          )}

          {/* ── 4. PAYMENT & INVOICE ────────────────────────────────────── */}
          {invoice && (
            <StepCard
              n={4}
              title="Payment & invoice"
              subtitle={<span className="font-mono">{invoice.invoiceNo}</span>}
              state={step === "done" ? "done" : "active"}
            >
              <div className="grid gap-3 sm:grid-cols-3">
                <div className="rounded-md border border-gray-200 px-4 py-3 dark:border-(--sa-border)">
                  <p className="text-xs text-gray-500 dark:text-(--sa-text-2)">Invoice total</p>
                  <p className="mt-0.5 text-lg font-semibold tabular-nums text-gray-900 dark:text-(--sa-text)">{formatMoney(invoice.totalAmount)}</p>
                </div>
                <div className="rounded-md border border-gray-200 px-4 py-3 dark:border-(--sa-border)">
                  <p className="text-xs text-gray-500 dark:text-(--sa-text-2)">Paid</p>
                  <p className="mt-0.5 text-lg font-semibold tabular-nums text-gray-900 dark:text-(--sa-text)">{formatMoney(paidSoFar)}</p>
                </div>
                <div className={cn(
                  "rounded-md border px-4 py-3",
                  invoice.balanceDue > EPSILON
                    ? "border-gray-900 dark:border-white/40"
                    : "border-gray-200 bg-gray-50 dark:border-(--sa-border) dark:bg-white/[0.03]"
                )}>
                  <p className="text-xs text-gray-600 dark:text-(--sa-text-2)">{invoice.balanceDue > EPSILON ? "Due" : "Status"}</p>
                  <p className={cn(
                    "mt-0.5 text-lg font-semibold tabular-nums",
                    "text-gray-900 dark:text-(--sa-text)"
                  )}>
                    {invoice.balanceDue > EPSILON ? formatMoney(invoice.balanceDue) : "Paid in full"}
                  </p>
                </div>
              </div>

              {invoice.balanceDue > EPSILON && (
                <div className="space-y-3 rounded-md border border-gray-200 p-4 dark:border-(--sa-border)">
                  <div className="space-y-2">
                    {splits.map((split, i) => (
                      <div key={split.id} className="grid gap-2 grid-cols-[1fr_1fr_1fr_auto] items-end">
                        <div>
                          {i === 0 && <label className={labelCls}>Method</label>}
                          <select value={split.method} onChange={(e) => setSplits(prev => prev.map((s, idx) => idx === i ? { ...s, method: e.target.value } : s))} className={inputCls}>
                            {PAY_METHODS.map((m) => <option key={m} value={m}>{labelise(m)}</option>)}
                          </select>
                        </div>
                        <div>
                          {i === 0 && <label className={labelCls}>Amount (₹)</label>}
                          <input type="number" min={0} step="0.01" value={split.amount}
                            onChange={(e) => setSplits(prev => prev.map((s, idx) => idx === i ? { ...s, amount: e.target.value } : s))}
                            className={inputCls} placeholder="Amount" />
                        </div>
                        <div>
                          {i === 0 && <label className={labelCls}>Reference</label>}
                          <input value={split.reference}
                            onChange={(e) => setSplits(prev => prev.map((s, idx) => idx === i ? { ...s, reference: e.target.value } : s))}
                            className={inputCls} placeholder="UPI ref, last 4…" />
                        </div>
                        <div className={i === 0 ? "self-end" : ""}>
                          {splits.length > 1 ? (
                            <button type="button" onClick={() => setSplits(prev => prev.filter((_, idx) => idx !== i))}
                              className="inline-flex size-9 items-center justify-center rounded text-gray-400 hover:bg-red-50 hover:text-red-500 dark:hover:bg-red-500/10">
                              <X className="size-4" />
                            </button>
                          ) : <div className="size-9" />}
                        </div>
                      </div>
                    ))}
                  </div>
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <button type="button" onClick={() => setSplits(prev => [...prev, newSplit()])} className={cn(btnGhost, "text-xs")}>
                      <PlusCircle className="size-3.5" /> Add payment method
                    </button>
                    <div className="flex flex-wrap items-center gap-2">
                      {totalSplitAmount !== invoice.balanceDue && totalSplitAmount === 0 && (
                        <button type="button" onClick={() => setSplits([{ ...newSplit(), amount: String(invoice.balanceDue) }])} className={btnGhost}>
                          Fill full due
                        </button>
                      )}
                      {splits.length > 1 && totalSplitAmount > 0 && (
                        <span className="text-xs text-gray-500 dark:text-(--sa-muted)">
                          Total: {formatMoney(totalSplitAmount)} / {formatMoney(invoice.balanceDue)}
                        </span>
                      )}
                      <button
                        type="button"
                        onClick={collect}
                        disabled={busy || !(totalSplitAmount > 0) || totalSplitAmount > invoice.balanceDue + EPSILON}
                        className={btnPrimary}
                      >
                        {busy ? spinner : <Wallet className="size-4" aria-hidden="true" />}
                        Collect {totalSplitAmount > 0 ? formatMoney(totalSplitAmount) : "payment"}
                      </button>
                    </div>
                  </div>
                </div>
              )}

              {/* Print & share */}
              <div className="space-y-2">
                <p className="text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-(--sa-text-2)">Print &amp; share</p>
                <div className="flex flex-wrap items-center gap-2">
                  <div className="flex h-9 items-center overflow-hidden rounded-md border border-gray-200 dark:border-(--sa-border)">
                    <button
                      type="button"
                      onClick={() => openPdf()}
                      className="inline-flex h-full items-center gap-2 px-3.5 text-sm font-medium text-gray-700 transition hover:bg-gray-100 hover:text-gray-900 dark:text-(--sa-text) dark:hover:bg-(--sa-hover)"
                    >
                      <Printer className="size-4" aria-hidden="true" /> Print
                    </button>
                    <span className="h-full w-px bg-gray-200 dark:bg-(--sa-border)" aria-hidden="true" />
                    {(["A4", "THERMAL_80", "THERMAL_58"] as PrintFormat[]).map((fmt) => (
                      <button
                        key={fmt}
                        type="button"
                        onClick={() => setPrintSize(fmt)}
                        aria-pressed={printSize === fmt}
                        className={cn(
                          "h-full px-3 text-xs font-medium transition",
                          printSize === fmt
                            ? "bg-gray-900 text-white"
                            : "text-gray-500 hover:bg-gray-100 hover:text-gray-900 dark:text-(--sa-text-2) dark:hover:bg-(--sa-hover)"
                        )}
                      >
                        {PRINT_LABELS[fmt]}
                      </button>
                    ))}
                  </div>
                  {/* Receipt text size — only meaningful for the thermal roll, not the A4 PDF. */}
                  {printSize !== "A4" && <ReceiptScaleControl />}
                  <button type="button" onClick={downloadPdf} className={btnSecondary}>
                    <Download className="size-4" aria-hidden="true" /> Download PDF
                  </button>
                  <button type="button" onClick={() => void copyLink()} className={btnSecondary}>
                    {copied ? <Check className="size-4" aria-hidden="true" /> : <Share2 className="size-4" aria-hidden="true" />}
                    {copied ? "Link copied" : "Copy link"}
                  </button>
                  <button
                    type="button"
                    onClick={() => send("WHATSAPP")}
                    disabled={busy}
                    className={btnSecondary}
                  >
                    <MessageCircle className="size-4" aria-hidden="true" /> WhatsApp
                  </button>
                  <button
                    type="button"
                    onClick={() => send("EMAIL")}
                    disabled={busy}
                    className={btnSecondary}
                  >
                    <Mail className="size-4" aria-hidden="true" /> Email
                  </button>
                </div>
              </div>

              {step === "done" && (
                <div className={cn(panelMuted, "flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between")}>
                  <p className="flex items-center gap-2 text-sm font-medium text-gray-900 dark:text-(--sa-text)">
                    <CircleCheck className="size-5 shrink-0" aria-hidden="true" />
                    <span>
                      All done — {customer?.firstName}&apos;s visit is billed and paid.
                      {unassignedCount > 0 && (
                        <span className="block text-xs font-normal text-amber-700 dark:text-amber-300">
                          Staff still missing on {unassignedCount} service{unassignedCount === 1 ? "" : "s"} — assign above whenever you are ready.
                        </span>
                      )}
                    </span>
                  </p>
                  <div className="flex flex-wrap gap-2">
                    <a href={`${billingBasePath}/${invoice.id}`} className={btnSecondary}>
                      <ExternalLink className="size-4" aria-hidden="true" /> Open invoice
                    </a>
                    <button type="button" onClick={reset} className={btnPrimary}>
                      <UserPlus className="size-4" aria-hidden="true" /> Next customer
                    </button>
                  </div>
                </div>
              )}
            </StepCard>
          )}
        </div>

        {/* ── Running total (sticky) ─────────────────────────────────────── */}
        <Card className="h-fit overflow-hidden rounded-lg xl:sticky xl:top-20">
          <div className="border-b border-gray-100 px-5 py-3.5 dark:border-(--sa-border)">
            <h3 className="text-sm font-semibold text-gray-900 dark:text-(--sa-text)">Bill preview</h3>
            {customer && <p className="text-xs text-gray-500 dark:text-(--sa-text-2)">{customerName}</p>}
          </div>
          <div className="p-5">
            {chosen.length === 0 ? (
              <p className="py-8 text-center text-sm text-gray-400 dark:text-(--sa-muted)">
                Add services to see the total.
              </p>
            ) : (
              <dl className="space-y-2 text-sm">
                {chosen.map((s) => (
                  <div key={s.id} className="flex justify-between gap-3">
                    <dt className="text-gray-600 dark:text-(--sa-text-2)">{s.name}</dt>
                    <dd className="tabular-nums text-gray-900 dark:text-(--sa-text)">{formatMoney(s.price)}</dd>
                  </div>
                ))}
                <div className="flex justify-between border-t border-gray-100 pt-2 dark:border-(--sa-border)">
                  <dt className="text-gray-500 dark:text-(--sa-text-2)">Subtotal</dt>
                  <dd className="tabular-nums text-gray-900 dark:text-(--sa-text)">{formatMoney(subtotal)}</dd>
                </div>
                {discountVal > 0 && (
                  <div className="flex justify-between">
                    <dt className="text-gray-500 dark:text-(--sa-text-2)">Discount</dt>
                    <dd className="tabular-nums text-gray-900 dark:text-(--sa-text)">− {formatMoney(discountVal)}</dd>
                  </div>
                )}
                <div className="flex justify-between">
                  <dt className="text-gray-500 dark:text-(--sa-text-2)">{taxName} ({taxPercent}%)</dt>
                  <dd className="tabular-nums text-gray-900 dark:text-(--sa-text)">{formatMoney(taxValue)}</dd>
                </div>
                <div className="flex items-baseline justify-between border-t border-gray-200 pt-3 dark:border-(--sa-border)">
                  <dt className="font-semibold text-gray-900 dark:text-(--sa-text)">Total</dt>
                  <dd className="text-xl font-semibold tabular-nums text-gray-900 dark:text-(--sa-text)">{formatMoney(grandTotal)}</dd>
                </div>
                <p className="pt-1 text-xs text-gray-400 dark:text-(--sa-muted)">
                  {duration} min · final figures are calculated when the bill is raised.
                </p>
              </dl>
            )}

            {invoice && (
              <dl className="mt-4 space-y-2 rounded-md bg-gray-50 p-4 text-sm dark:bg-white/5">
                <div className="flex justify-between">
                  <dt className="text-gray-500 dark:text-(--sa-text-2)">Invoice</dt>
                  <dd className="font-mono text-xs text-gray-900 dark:text-(--sa-text)">{invoice.invoiceNo}</dd>
                </div>
                <div className="flex justify-between">
                  <dt className="text-gray-500 dark:text-(--sa-text-2)">Billed</dt>
                  <dd className="tabular-nums text-gray-900 dark:text-(--sa-text)">{formatMoney(invoice.totalAmount)}</dd>
                </div>
                <div className="flex justify-between">
                  <dt className="text-gray-500 dark:text-(--sa-text-2)">Paid</dt>
                  <dd className="tabular-nums text-gray-900 dark:text-(--sa-text)">{formatMoney(paidSoFar)}</dd>
                </div>
                <div className="flex justify-between font-semibold">
                  <dt className="text-gray-700 dark:text-(--sa-text)">Due</dt>
                  <dd className="tabular-nums text-gray-900 dark:text-(--sa-text)">
                    {formatMoney(invoice.balanceDue)}
                  </dd>
                </div>
              </dl>
            )}
          </div>
        </Card>
      </div>
    </div>
  );
}
