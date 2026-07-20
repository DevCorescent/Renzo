"use client";

import { useState, useEffect, useMemo } from "react";
import { useRouter } from "next/navigation";
import { API } from "@/lib/endpoints";
import {
  User, Scissors, CalendarClock, Loader2, Check, Clock, Wallet,
} from "lucide-react";

// OWNER: Hemant | MODULE: Reception — New Walk-in Booking
// Two-column layout with a live summary rail. Only services actually offered at
// THIS branch are listed (branch-scoped), and workers come from the public
// endpoint so a receptionist (no admin access) can still load them.

type Service = {
  id: string;
  name: string;
  duration: number;
  basePrice: number;
  branchPricings?: { price: number }[];
  category?: { name: string };
};
type Worker = { id: string; firstName: string; lastName: string; displayName?: string | null };
type SlotEntry = { time: string; status: "AVAILABLE" | "BOOKED" | "PAST" };

function fmt(n: number) {
  return `₹${n.toLocaleString("en-IN")}`;
}
function servicePrice(s: Service) {
  return s.branchPricings?.[0]?.price ?? s.basePrice;
}
function workerLabel(w: Worker) {
  return w.displayName?.trim() || `${w.firstName} ${w.lastName}`.trim();
}

export default function ReceptionNewBookingPage() {
  const router = useRouter();
  const [branchId, setBranchId] = useState<string | null>(null);
  const [services, setServices] = useState<Service[]>([]);
  const [workers, setWorkers] = useState<Worker[]>([]);
  const [slotGrid, setSlotGrid] = useState<SlotEntry[]>([]);
  const [loadingServices, setLoadingServices] = useState(true);

  const [customerPhone, setCustomerPhone] = useState("");
  const [customerName, setCustomerName] = useState("");
  const [selectedServices, setSelectedServices] = useState<string[]>([]);
  const [workerId, setWorkerId] = useState("");
  const [date, setDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [startTime, setStartTime] = useState("");
  const [notes, setNotes] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  // Resolve the reception's branch, then load that branch's services + workers.
  useEffect(() => {
    let cancelled = false;
    fetch(API.auth.me)
      .then((r) => r.json())
      .then((d) => {
        const bid: string | null = d.data?.user?.branchId ?? null;
        if (cancelled) return;
        setBranchId(bid);
        const svcUrl = bid
          ? `${API.public.services}?branchId=${bid}&limit=100`
          : `${API.public.services}?limit=100`;
        fetch(svcUrl)
          .then((r) => r.json())
          .then((s) => { if (!cancelled) setServices(s.data?.items ?? s.data ?? []); })
          .finally(() => { if (!cancelled) setLoadingServices(false); });
        const wkUrl = bid ? `${API.public.workers}?branchId=${bid}&limit=50` : `${API.public.workers}?limit=50`;
        fetch(wkUrl)
          .then((r) => r.json())
          .then((w) => { if (!cancelled) setWorkers(w.data?.items ?? w.data ?? []); });
      })
      .catch(() => { if (!cancelled) setLoadingServices(false); });
    return () => { cancelled = true; };
  }, []);

  // Slots for the picked worker + date, based on the first selected service.
  useEffect(() => {
    if (!branchId || !workerId || !date || selectedServices.length === 0) {
      setSlotGrid([]);
      return;
    }
    let cancelled = false;
    const q = new URLSearchParams({ branchId, serviceId: selectedServices[0], date, workerId });
    fetch(`${API.public.slots}?${q}`)
      .then((r) => r.json())
      .then((d) => { if (!cancelled) setSlotGrid(d.data?.slotGrid ?? []); })
      .catch(() => { if (!cancelled) setSlotGrid([]); });
    return () => { cancelled = true; };
  }, [branchId, workerId, date, selectedServices]);

  function toggleService(id: string) {
    setSelectedServices((prev) =>
      prev.includes(id) ? prev.filter((s) => s !== id) : [...prev, id]
    );
    setStartTime("");
  }

  const chosen = useMemo(
    () => services.filter((s) => selectedServices.includes(s.id)),
    [services, selectedServices]
  );
  const totalAmount = chosen.reduce((sum, s) => sum + servicePrice(s), 0);
  const totalDuration = chosen.reduce((sum, s) => sum + s.duration, 0);

  // Group services by category for a tidier picker.
  const grouped = useMemo(() => {
    const map = new Map<string, Service[]>();
    for (const s of services) {
      const cat = s.category?.name ?? "Services";
      if (!map.has(cat)) map.set(cat, []);
      map.get(cat)!.push(s);
    }
    return Array.from(map.entries());
  }, [services]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    if (!customerPhone || selectedServices.length === 0 || !date || !startTime) {
      setError("Phone, at least one service, date, and time are required.");
      return;
    }
    setLoading(true);
    try {
      const res = await fetch(API.reception.appointments, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          customerPhone,
          customerName,
          serviceIds: selectedServices,
          workerId: workerId || undefined,
          appointmentDate: date,
          startTime,
          notes,
        }),
      });
      const data = await res.json();
      if (!res.ok) { setError(data.message ?? "Booking failed"); return; }
      router.push("/reception/checkin");
      router.refresh();
    } catch {
      setError("Network error");
    } finally {
      setLoading(false);
    }
  }

  const canBook = customerPhone && selectedServices.length > 0 && date && startTime;

  return (
    <div className="mx-auto max-w-5xl space-y-6">
      <div>
        <h1 className="text-xl font-semibold text-gray-900">New Walk-in Booking</h1>
        <p className="mt-0.5 text-sm text-gray-500">Create an appointment for a walk-in customer</p>
      </div>

      <form onSubmit={handleSubmit} className="grid gap-6 lg:grid-cols-[1fr_320px]">
        {/* ── Left: inputs ──────────────────────────────────────────────── */}
        <div className="space-y-5">
          {/* Customer */}
          <section className="rounded-lg border border-gray-200 bg-white p-4">
            <h2 className="mb-3 flex items-center gap-2 text-sm font-semibold text-gray-700">
              <User className="size-4 text-gray-400" /> Customer
            </h2>
            <div className="grid gap-4 sm:grid-cols-2">
              <label className="block">
                <span className="mb-1 block text-xs font-medium text-gray-600">Phone *</span>
                <input
                  type="tel"
                  inputMode="numeric"
                  value={customerPhone}
                  onChange={(e) => setCustomerPhone(e.target.value.replace(/\D/g, "").slice(0, 10))}
                  className={inputCls}
                  placeholder="9876543210"
                />
              </label>
              <label className="block">
                <span className="mb-1 block text-xs font-medium text-gray-600">Name <span className="text-gray-400">(new customers)</span></span>
                <input
                  type="text"
                  value={customerName}
                  onChange={(e) => setCustomerName(e.target.value)}
                  className={inputCls}
                  placeholder="Full name"
                />
              </label>
            </div>
          </section>

          {/* Services */}
          <section className="rounded-lg border border-gray-200 bg-white p-4">
            <h2 className="mb-3 flex items-center gap-2 text-sm font-semibold text-gray-700">
              <Scissors className="size-4 text-gray-400" /> Services *
              <span className="ml-auto text-[11px] font-normal text-gray-400">
                Only services offered at this branch
              </span>
            </h2>
            {loadingServices ? (
              <div className="flex justify-center py-10"><Loader2 className="size-5 animate-spin text-gray-400" /></div>
            ) : services.length === 0 ? (
              <p className="py-8 text-center text-sm text-gray-400">
                No services configured for this branch yet.
              </p>
            ) : (
              <div className="space-y-4">
                {grouped.map(([cat, items]) => (
                  <div key={cat}>
                    <p className="mb-2 text-[10px] font-bold uppercase tracking-widest text-gray-400">{cat}</p>
                    <div className="grid gap-2 sm:grid-cols-2">
                      {items.map((s) => {
                        const active = selectedServices.includes(s.id);
                        return (
                          <button
                            key={s.id}
                            type="button"
                            onClick={() => toggleService(s.id)}
                            className={`flex items-start justify-between rounded-lg border p-3 text-left text-sm transition ${
                              active ? "border-gray-800 bg-gray-50 ring-1 ring-gray-800" : "border-gray-200 hover:border-gray-300"
                            }`}
                          >
                            <div>
                              <p className="flex items-center gap-1.5 font-medium text-gray-900">
                                {active && <Check className="size-3.5 text-gray-800" />}
                                {s.name}
                              </p>
                              <p className="text-[11px] text-gray-400">{s.duration} min</p>
                            </div>
                            <p className="font-medium text-gray-700">{fmt(servicePrice(s))}</p>
                          </button>
                        );
                      })}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </section>

          {/* Schedule */}
          <section className="rounded-lg border border-gray-200 bg-white p-4">
            <h2 className="mb-3 flex items-center gap-2 text-sm font-semibold text-gray-700">
              <CalendarClock className="size-4 text-gray-400" /> Schedule
            </h2>
            <div className="grid gap-4 sm:grid-cols-2">
              <label className="block">
                <span className="mb-1 block text-xs font-medium text-gray-600">Worker</span>
                <select value={workerId} onChange={(e) => { setWorkerId(e.target.value); setStartTime(""); }} className={inputCls}>
                  <option value="">Any available</option>
                  {workers.map((w) => (
                    <option key={w.id} value={w.id}>{workerLabel(w)}</option>
                  ))}
                </select>
              </label>
              <label className="block">
                <span className="mb-1 block text-xs font-medium text-gray-600">Date *</span>
                <input
                  type="date"
                  value={date}
                  onChange={(e) => { setDate(e.target.value); setStartTime(""); }}
                  min={new Date().toISOString().slice(0, 10)}
                  className={inputCls}
                />
              </label>
            </div>

            <div className="mt-4">
              <span className="mb-1.5 block text-xs font-medium text-gray-600">Time *</span>
              {workerId && slotGrid.length > 0 ? (
                <div className="flex flex-wrap gap-2">
                  {slotGrid.filter((s) => s.status !== "PAST").map((s) => {
                    const booked = s.status === "BOOKED";
                    return (
                      <button
                        key={s.time}
                        type="button"
                        disabled={booked}
                        onClick={() => setStartTime(s.time)}
                        className={`rounded border px-3 py-1.5 font-mono text-sm transition ${
                          booked
                            ? "cursor-not-allowed border-gray-100 bg-gray-50 text-gray-300"
                            : startTime === s.time
                              ? "border-gray-900 bg-gray-900 text-white"
                              : "border-gray-200 hover:border-gray-400"
                        }`}
                      >
                        {s.time}
                      </button>
                    );
                  })}
                </div>
              ) : (
                <input
                  type="time"
                  value={startTime}
                  onChange={(e) => setStartTime(e.target.value)}
                  className={`${inputCls} max-w-40`}
                />
              )}
              {workerId && slotGrid.length === 0 && selectedServices.length > 0 && (
                <p className="mt-1.5 text-[11px] text-gray-400">
                  No live slots for this stylist/date — enter a time manually.
                </p>
              )}
            </div>

            <label className="mt-4 block">
              <span className="mb-1 block text-xs font-medium text-gray-600">Notes</span>
              <textarea
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                rows={2}
                className={inputCls}
                placeholder="Any special instructions…"
              />
            </label>
          </section>
        </div>

        {/* ── Right: live summary ───────────────────────────────────────── */}
        <aside className="lg:sticky lg:top-20 h-fit space-y-4 rounded-lg border border-gray-200 bg-white p-4">
          <h2 className="text-xs font-semibold uppercase tracking-widest text-gray-400">Summary</h2>

          <div className="space-y-2">
            {chosen.length === 0 ? (
              <p className="text-sm text-gray-400">No services selected yet.</p>
            ) : (
              chosen.map((s) => (
                <div key={s.id} className="flex items-center justify-between text-sm">
                  <span className="text-gray-700">{s.name}</span>
                  <span className="text-gray-500">{fmt(servicePrice(s))}</span>
                </div>
              ))
            )}
          </div>

          <div className="space-y-1.5 border-t border-gray-100 pt-3 text-sm">
            <Row icon={Clock} label="Duration" value={totalDuration ? `${totalDuration} min` : "—"} />
            <Row icon={User} label="Stylist" value={workers.find((w) => w.id === workerId) ? workerLabel(workers.find((w) => w.id === workerId)!) : "Any available"} />
            <Row icon={CalendarClock} label="When" value={startTime ? `${new Date(date).toLocaleDateString("en-IN", { day: "numeric", month: "short" })} · ${startTime}` : "—"} />
          </div>

          <div className="flex items-end justify-between border-t border-gray-100 pt-3">
            <span className="flex items-center gap-1.5 text-xs font-medium uppercase tracking-wide text-gray-400">
              <Wallet className="size-3.5" /> Total
            </span>
            <span className="text-xl font-bold text-gray-900">{fmt(totalAmount)}</span>
          </div>

          {error && <p className="rounded border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-600">{error}</p>}

          <button
            type="submit"
            disabled={loading || !canBook}
            className="flex w-full items-center justify-center gap-2 rounded bg-gray-900 px-4 py-2.5 text-sm font-medium text-white transition hover:bg-gray-800 disabled:opacity-50"
          >
            {loading && <Loader2 className="size-4 animate-spin" />}
            {loading ? "Booking…" : "Confirm Booking"}
          </button>
          <p className="text-center text-[11px] text-gray-400">Walk-in · Pay at desk</p>
        </aside>
      </form>
    </div>
  );
}

const inputCls =
  "w-full rounded border border-gray-300 px-3 py-2 text-sm outline-none focus:border-gray-500";

function Row({
  icon: Icon,
  label,
  value,
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  value: string;
}) {
  return (
    <div className="flex items-center justify-between">
      <span className="flex items-center gap-1.5 text-gray-500">
        <Icon className="size-3.5 text-gray-400" /> {label}
      </span>
      <span className="font-medium text-gray-800">{value}</span>
    </div>
  );
}
