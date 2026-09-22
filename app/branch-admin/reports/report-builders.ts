// ============================================================================
// Reports page — turns the export API's data into downloadable report tables.
// Rendering (CSV / PDF) is shared with the Sheet via lib/report-export.
// ============================================================================

import { money, type Report, type Table } from "@/lib/report-export";

// ─── Data shape returned by /api/v1/branch-admin/reports/export ─────────────

export interface ExportData {
  branchName: string;
  from: string;
  to: string;
  invoices: {
    invoiceNo: string; date: string; customer: string; phone: string; status: string;
    subtotal: number; discount: number; tax: number; total: number; paid: number; balance: number;
    methods: string[];
    items: { type: string; name: string; quantity: number; unitPrice: number; discount: number; taxAmount: number; total: number }[];
  }[];
  payments: {
    date: string; time: string; invoiceNo: string; customer: string; method: string; reference: string; amount: number;
  }[];
  appointments: {
    appointmentNo: string; date: string; time: string; customer: string; phone: string; worker: string;
    status: string; source: string; total: number; paid: number; paymentStatus: string; customerId: string;
    services: { name: string; price: number; status: string; workerId: string | null; worker: string }[];
  }[];
  expenses: {
    date: string; category: string; description: string; vendor: string; paidVia: string; reference: string; amount: number;
  }[];
}

export type ReportsId = "summary" | "sales" | "payments" | "daily" | "items" | "workers" | "appointments" | "expenses";

export const REPORTS_OPTIONS: { id: ReportsId; name: string; description: string }[] = [
  { id: "summary",      name: "Business summary",    description: "Everything below in one file — revenue, collections, staff, expenses" },
  { id: "daily",        name: "Daily revenue",       description: "Billed, collected, expenses and net for every day" },
  { id: "sales",        name: "Sales register",      description: "Every invoice with discount, tax, paid and balance" },
  { id: "payments",     name: "Payments collected",  description: "Each payment received, with a cash / UPI / card split" },
  { id: "items",        name: "Service & item sales", description: "What was sold — quantity and revenue per service or product" },
  { id: "workers",      name: "Worker performance",  description: "Services done, revenue and customers per worker" },
  { id: "appointments", name: "Appointments",        description: "Every booking with status, source and amount" },
  { id: "expenses",     name: "Expenses",            description: "Spend by category and every expense entry" },
];

// ─── Helpers ──────────────────────────────────────────────────────────────────

const DAY   = ["Sun","Mon","Tue","Wed","Thu","Fri","Sat"];
const MONTH = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];

function fullDate(ymd: string): string {
  const d = new Date(ymd + "T00:00:00");
  return `${DAY[d.getDay()]}, ${d.getDate()} ${MONTH[d.getMonth()]} ${d.getFullYear()}`;
}

/** Compact date for long lists, so the column never wraps: "1 Sep 2026". */
function shortDate(ymd: string): string {
  const d = new Date(ymd + "T00:00:00");
  return `${d.getDate()} ${MONTH[d.getMonth()]} ${d.getFullYear()}`;
}

function eachDay(from: string, to: string): string[] {
  const out: string[] = [];
  const cur = new Date(from + "T00:00:00Z"), end = new Date(to + "T00:00:00Z");
  while (cur <= end) { out.push(cur.toISOString().slice(0, 10)); cur.setUTCDate(cur.getUTCDate() + 1); }
  return out;
}

const ACRONYMS = new Set(["UPI"]);

/** "GIFT_CARD" → "Gift Card", "UPI" stays "UPI". */
const pretty = (s: string) =>
  ACRONYMS.has(s) ? s
  : s.includes("_") || s === s.toUpperCase()
    ? s.toLowerCase().split("_").map((w) => w.charAt(0).toUpperCase() + w.slice(1)).join(" ")
    : s;

const sum = <T,>(xs: T[], f: (x: T) => number) => xs.reduce((n, x) => n + (f(x) || 0), 0);
const share = (part: number, whole: number) => (whole ? (part / whole) * 100 : 0);

const DEAD = new Set(["CANCELLED", "NO_SHOW"]);

// ─── Aggregation ──────────────────────────────────────────────────────────────

function aggregate(d: ExportData) {
  const billed      = sum(d.invoices, (i) => i.total);
  const collected   = sum(d.payments, (p) => p.amount);
  const outstanding = sum(d.invoices, (i) => i.balance);
  const discount    = sum(d.invoices, (i) => i.discount);
  const tax         = sum(d.invoices, (i) => i.tax);
  const spent       = sum(d.expenses, (e) => e.amount);
  const completed   = d.appointments.filter((a) => a.status === "COMPLETED").length;
  return { billed, collected, outstanding, discount, tax, spent, completed, net: collected - spent };
}

type Agg = ReturnType<typeof aggregate>;

function stats(d: ExportData, a: Agg) {
  return [
    { label: "Billed",              value: money(a.billed) },
    { label: "Collected",           value: money(a.collected) },
    { label: "Outstanding",         value: money(a.outstanding) },
    { label: "Expenses",            value: money(a.spent) },
    { label: "Net",                 value: money(a.net) },
    { label: "Invoices",            value: `${d.invoices.length} · avg ${money(d.invoices.length ? Math.round(a.billed / d.invoices.length) : 0)}` },
    { label: "Appointments",        value: `${d.appointments.length} · ${d.appointments.length ? Math.round(share(a.completed, d.appointments.length)) : 0}% done` },
  ];
}

// ─── Tables ───────────────────────────────────────────────────────────────────

function dailyTable(d: ExportData, a: Agg): Table {
  const days = eachDay(d.from, d.to);
  const by = new Map(days.map((k) => [k, { invoices: 0, billed: 0, discount: 0, tax: 0, collected: 0, spent: 0 }]));
  for (const i of d.invoices) { const r = by.get(i.date); if (r) { r.invoices++; r.billed += i.total; r.discount += i.discount; r.tax += i.tax; } }
  for (const p of d.payments) { const r = by.get(p.date); if (r) r.collected += p.amount; }
  for (const e of d.expenses) { const r = by.get(e.date); if (r) r.spent += e.amount; }
  return {
    title: "Daily revenue",
    note: "Billed = invoices raised that day. Collected = payments received that day. Net = collected − expenses.",
    columns: [
      { label: "Date" }, { label: "Invoices", kind: "int" }, { label: "Billed", kind: "money" },
      { label: "Discount", kind: "money" }, { label: "Tax", kind: "money" }, { label: "Collected", kind: "money" },
      { label: "Expenses", kind: "money" }, { label: "Net", kind: "money" },
    ],
    rows: days.map((k) => {
      const r = by.get(k)!;
      const empty = !r.invoices && !r.collected && !r.spent;
      return [fullDate(k), r.invoices || null, r.billed || null, r.discount || null, r.tax || null,
        r.collected || null, r.spent || null, empty ? null : r.collected - r.spent];
    }),
    footer: ["Total", d.invoices.length, a.billed, a.discount, a.tax, a.collected, a.spent, a.net],
  };
}

function salesTable(d: ExportData, a: Agg): Table {
  return {
    title: "Sales register",
    columns: [
      { label: "Invoice" }, { label: "Date" }, { label: "Customer" }, { label: "Phone" }, { label: "Items", weight: 2.6 },
      { label: "Subtotal", kind: "money" }, { label: "Discount", kind: "money" }, { label: "Tax", kind: "money" },
      { label: "Total", kind: "money" }, { label: "Paid", kind: "money" }, { label: "Balance", kind: "money" },
      { label: "Paid via" }, { label: "Status" },
    ],
    rows: d.invoices.map((i) => [
      i.invoiceNo, shortDate(i.date), i.customer, i.phone,
      i.items.map((it) => (it.quantity > 1 ? `${it.name} ×${it.quantity}` : it.name)).join("; "),
      i.subtotal, i.discount || null, i.tax || null, i.total, i.paid, i.balance || null,
      i.methods.map(pretty).join(", "), pretty(i.status),
    ]),
    footer: [`${d.invoices.length} invoices`, "", "", "", "", sum(d.invoices, (i) => i.subtotal), a.discount, a.tax,
      a.billed, sum(d.invoices, (i) => i.paid), a.outstanding, "", ""],
  };
}

function methodTable(d: ExportData, a: Agg): Table {
  const by = new Map<string, { count: number; amount: number }>();
  for (const p of d.payments) {
    const r = by.get(p.method) ?? { count: 0, amount: 0 };
    r.count++; r.amount += p.amount; by.set(p.method, r);
  }
  const rows = [...by.entries()].sort((x, y) => y[1].amount - x[1].amount);
  return {
    title: "Collections by payment method",
    columns: [{ label: "Method" }, { label: "Payments", kind: "int" }, { label: "Share", kind: "pct" }, { label: "Amount", kind: "money" }],
    rows: rows.map(([m, r]) => [pretty(m), r.count, share(r.amount, a.collected), r.amount]),
    footer: ["Total", d.payments.length, a.collected ? 100 : 0, a.collected],
  };
}

function paymentsTable(d: ExportData, a: Agg): Table {
  return {
    title: "Payments collected",
    columns: [
      { label: "#", kind: "int" }, { label: "Date" }, { label: "Time" }, { label: "Invoice" }, { label: "Customer" },
      { label: "Method" }, { label: "Reference" }, { label: "Amount", kind: "money" },
    ],
    rows: d.payments.map((p, i) => [i + 1, shortDate(p.date), p.time, p.invoiceNo, p.customer, pretty(p.method), p.reference, p.amount]),
    footer: ["", "Total", "", "", "", "", `${d.payments.length} payments`, a.collected],
  };
}

function itemsTable(d: ExportData): Table {
  const by = new Map<string, { name: string; type: string; qty: number; gross: number; discount: number; tax: number; total: number }>();
  for (const inv of d.invoices) for (const it of inv.items) {
    const key = `${it.type}|${it.name}`;
    const r = by.get(key) ?? { name: it.name, type: it.type, qty: 0, gross: 0, discount: 0, tax: 0, total: 0 };
    r.qty += it.quantity; r.gross += it.unitPrice * it.quantity; r.discount += it.discount; r.tax += it.taxAmount; r.total += it.total;
    by.set(key, r);
  }
  const rows = [...by.values()].sort((x, y) => y.total - x.total);
  const total = sum(rows, (r) => r.total);
  return {
    title: "Service & item sales",
    columns: [
      { label: "#", kind: "int" }, { label: "Item", weight: 2.4 }, { label: "Type" }, { label: "Qty", kind: "int" },
      { label: "Avg price", kind: "money" }, { label: "Discount", kind: "money" }, { label: "Tax", kind: "money" },
      { label: "Share", kind: "pct" }, { label: "Revenue", kind: "money" },
    ],
    rows: rows.map((r, i) => [i + 1, r.name, pretty(r.type), r.qty, r.qty ? Math.round(r.gross / r.qty) : 0,
      r.discount || null, r.tax || null, share(r.total, total), r.total]),
    footer: ["", "Total", "", sum(rows, (r) => r.qty), null, sum(rows, (r) => r.discount), sum(rows, (r) => r.tax), total ? 100 : 0, total],
  };
}

function workersTable(d: ExportData): Table {
  const by = new Map<string, { name: string; booked: number; done: number; revenue: number; customers: Set<string> }>();
  for (const appt of d.appointments) {
    if (DEAD.has(appt.status)) continue;
    for (const s of appt.services) {
      if (DEAD.has(s.status)) continue;
      const key = s.workerId ?? "unassigned";
      const r = by.get(key) ?? { name: s.worker || "Unassigned", booked: 0, done: 0, revenue: 0, customers: new Set<string>() };
      r.booked++;
      if (s.status === "COMPLETED" || appt.status === "COMPLETED") {
        r.done++; r.revenue += s.price; r.customers.add(appt.customerId);
      }
      by.set(key, r);
    }
  }
  const rows = [...by.values()].sort((x, y) => y.revenue - x.revenue);
  const revenue = sum(rows, (r) => r.revenue);
  return {
    title: "Worker performance",
    note: "From appointments in the period (cancelled and no-shows excluded). Revenue is the list price of completed services.",
    columns: [
      { label: "#", kind: "int" }, { label: "Worker" }, { label: "Services booked", kind: "int" },
      { label: "Services done", kind: "int" }, { label: "Customers", kind: "int" }, { label: "Avg / service", kind: "money" },
      { label: "Share", kind: "pct" }, { label: "Revenue", kind: "money" },
    ],
    rows: rows.map((r, i) => [i + 1, r.name, r.booked, r.done, r.customers.size,
      r.done ? Math.round(r.revenue / r.done) : 0, share(r.revenue, revenue), r.revenue]),
    footer: ["", "Total", sum(rows, (r) => r.booked), sum(rows, (r) => r.done), null, null, revenue ? 100 : 0, revenue],
  };
}

function statusTable(d: ExportData): Table {
  const by = new Map<string, { count: number; value: number }>();
  for (const a of d.appointments) {
    const r = by.get(a.status) ?? { count: 0, value: 0 };
    r.count++; r.value += a.total; by.set(a.status, r);
  }
  const rows = [...by.entries()].sort((x, y) => y[1].count - x[1].count);
  return {
    title: "Appointments by status",
    columns: [{ label: "Status" }, { label: "Count", kind: "int" }, { label: "Share", kind: "pct" }, { label: "Booking value", kind: "money" }],
    rows: rows.map(([s, r]) => [pretty(s), r.count, share(r.count, d.appointments.length), r.value]),
    footer: ["Total", d.appointments.length, d.appointments.length ? 100 : 0, sum(d.appointments, (a) => a.total)],
  };
}

function appointmentsTable(d: ExportData): Table {
  return {
    title: "Appointments",
    columns: [
      { label: "Booking" }, { label: "Date" }, { label: "Time" }, { label: "Customer" }, { label: "Phone" },
      { label: "Worker" }, { label: "Services", weight: 2.2 }, { label: "Source" }, { label: "Status" },
      { label: "Amount", kind: "money" }, { label: "Paid", kind: "money" }, { label: "Payment" },
    ],
    rows: d.appointments.map((a) => [
      a.appointmentNo, shortDate(a.date), a.time, a.customer, a.phone, a.worker,
      a.services.map((s) => s.name).join("; "), pretty(a.source), pretty(a.status),
      a.total, a.paid || null, pretty(a.paymentStatus),
    ]),
    footer: [`${d.appointments.length} bookings`, "", "", "", "", "", "", "", "",
      sum(d.appointments, (a) => a.total), sum(d.appointments, (a) => a.paid), ""],
  };
}

function expenseCategoryTable(d: ExportData, a: Agg): Table {
  const by = new Map<string, { count: number; amount: number }>();
  for (const e of d.expenses) {
    const r = by.get(e.category) ?? { count: 0, amount: 0 };
    r.count++; r.amount += e.amount; by.set(e.category, r);
  }
  const rows = [...by.entries()].sort((x, y) => y[1].amount - x[1].amount);
  return {
    title: "Expenses by category",
    columns: [{ label: "Category" }, { label: "Entries", kind: "int" }, { label: "Share", kind: "pct" }, { label: "Amount", kind: "money" }],
    rows: rows.map(([c, r]) => [pretty(c), r.count, share(r.amount, a.spent), r.amount]),
    footer: ["Total", d.expenses.length, a.spent ? 100 : 0, a.spent],
  };
}

function expensesTable(d: ExportData, a: Agg): Table {
  return {
    title: "Expense entries",
    columns: [
      { label: "#", kind: "int" }, { label: "Date" }, { label: "Category", weight: 1.2 }, { label: "Description", weight: 2.4 },
      { label: "Vendor", weight: 1.2 }, { label: "Paid via", weight: 1 }, { label: "Bill / ref", weight: 1 }, { label: "Amount", kind: "money" },
    ],
    rows: d.expenses.map((e, i) => [i + 1, shortDate(e.date), pretty(e.category), e.description, e.vendor,
      pretty(e.paidVia), e.reference, e.amount]),
    footer: ["", "Total", "", `${d.expenses.length} entries`, "", "", "", a.spent],
  };
}

// ─── Entry point ──────────────────────────────────────────────────────────────

export function buildReportsReport(id: ReportsId, d: ExportData): Report {
  const a = aggregate(d);
  const name = REPORTS_OPTIONS.find((o) => o.id === id)!.name;
  const base = { title: name, stats: stats(d, a) };

  switch (id) {
    case "daily":        return { ...base, tables: [dailyTable(d, a)] };
    case "sales":        return { ...base, tables: [salesTable(d, a)] };
    case "payments":     return { ...base, tables: [methodTable(d, a), paymentsTable(d, a)] };
    case "items":        return { ...base, tables: [itemsTable(d)] };
    case "workers":      return { ...base, tables: [workersTable(d)] };
    case "appointments": return { ...base, tables: [statusTable(d), appointmentsTable(d)] };
    case "expenses":     return { ...base, tables: [expenseCategoryTable(d, a), expensesTable(d, a)] };
    case "summary":
      return {
        ...base, tables: [
          dailyTable(d, a), methodTable(d, a), itemsTable(d), workersTable(d),
          statusTable(d), expenseCategoryTable(d, a), salesTable(d, a),
        ],
      };
  }
}
