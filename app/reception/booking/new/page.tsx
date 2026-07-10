"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { API } from "@/lib/endpoints";

// OWNER: Hemant | MODULE: Reception — New Walk-in Booking

type Service = { id: string; name: string; duration: number; basePrice: number };
type Worker = { id: string; firstName: string; lastName: string };

function fmt(n: number) {
  return `₹${n.toLocaleString("en-IN")}`;
}

export default function ReceptionNewBookingPage() {
  const router = useRouter();
  const [services, setServices] = useState<Service[]>([]);
  const [workers, setWorkers] = useState<Worker[]>([]);
  const [slots, setSlots] = useState<string[]>([]);

  const [customerPhone, setCustomerPhone] = useState("");
  const [customerName, setCustomerName] = useState("");
  const [selectedServices, setSelectedServices] = useState<string[]>([]);
  const [workerId, setWorkerId] = useState("");
  const [date, setDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [startTime, setStartTime] = useState("");
  const [notes, setNotes] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    fetch(API.public.services)
      .then((r) => r.json())
      .then((d) => setServices(d.data?.items ?? d.data ?? []));
    fetch(API.admin.workers)
      .then((r) => r.json())
      .then((d) => setWorkers(d.data?.items ?? d.data ?? []));
  }, []);

  useEffect(() => {
    if (!workerId || !date || selectedServices.length === 0) { setSlots([]); return; }
    fetch(`${API.public.slots}?workerId=${workerId}&date=${date}&serviceIds=${selectedServices.join(",")}`)
      .then((r) => r.json())
      .then((d) => setSlots(d.data ?? []));
  }, [workerId, date, selectedServices]);

  function toggleService(id: string) {
    setSelectedServices((prev) =>
      prev.includes(id) ? prev.filter((s) => s !== id) : [...prev, id]
    );
  }

  const totalAmount = services
    .filter((s) => selectedServices.includes(s.id))
    .reduce((sum, s) => sum + s.basePrice, 0);

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
          source: "WALK_IN",
        }),
      });
      const data = await res.json();
      if (!res.ok) { setError(data.message ?? "Booking failed"); return; }
      router.push("/reception/checkin");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="mx-auto max-w-xl space-y-6">
      <div>
        <h1 className="text-xl font-semibold text-gray-900">New Walk-in Booking</h1>
        <p className="mt-0.5 text-sm text-gray-500">Create an appointment for a walk-in customer</p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-5">
        <div className="rounded border border-gray-200 bg-white p-4 space-y-4">
          <h2 className="text-sm font-semibold text-gray-700">Customer</h2>
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">Phone *</label>
            <input
              type="tel"
              value={customerPhone}
              onChange={(e) => setCustomerPhone(e.target.value)}
              className="w-full rounded border border-gray-300 px-3 py-2 text-sm focus:border-gray-500 focus:outline-none"
              placeholder="+91 98765 43210"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">Name (optional if existing customer)</label>
            <input
              type="text"
              value={customerName}
              onChange={(e) => setCustomerName(e.target.value)}
              className="w-full rounded border border-gray-300 px-3 py-2 text-sm focus:border-gray-500 focus:outline-none"
              placeholder="Full name"
            />
          </div>
        </div>

        <div className="rounded border border-gray-200 bg-white p-4 space-y-3">
          <h2 className="text-sm font-semibold text-gray-700">Services *</h2>
          <div className="grid gap-2 sm:grid-cols-2">
            {services.map((s) => (
              <button
                key={s.id}
                type="button"
                onClick={() => toggleService(s.id)}
                className={`flex items-start justify-between rounded border p-3 text-left text-sm transition-colors ${
                  selectedServices.includes(s.id)
                    ? "border-gray-800 bg-gray-50"
                    : "border-gray-200 hover:border-gray-300"
                }`}
              >
                <div>
                  <p className="font-medium text-gray-900">{s.name}</p>
                  <p className="text-[11px] text-gray-400">{s.duration} min</p>
                </div>
                <p className="text-sm text-gray-700">{fmt(s.basePrice)}</p>
              </button>
            ))}
          </div>
          {selectedServices.length > 0 && (
            <p className="text-xs text-gray-500">Total: <span className="font-semibold text-gray-900">{fmt(totalAmount)}</span></p>
          )}
        </div>

        <div className="rounded border border-gray-200 bg-white p-4 space-y-4">
          <h2 className="text-sm font-semibold text-gray-700">Schedule</h2>
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">Worker</label>
            <select
              value={workerId}
              onChange={(e) => setWorkerId(e.target.value)}
              className="w-full rounded border border-gray-300 px-3 py-2 text-sm focus:border-gray-500 focus:outline-none"
            >
              <option value="">Any available</option>
              {workers.map((w) => (
                <option key={w.id} value={w.id}>{w.firstName} {w.lastName}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">Date *</label>
            <input
              type="date"
              value={date}
              onChange={(e) => setDate(e.target.value)}
              min={new Date().toISOString().slice(0, 10)}
              className="w-full rounded border border-gray-300 px-3 py-2 text-sm focus:border-gray-500 focus:outline-none"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">Time *</label>
            {slots.length > 0 ? (
              <div className="flex flex-wrap gap-2">
                {slots.map((s) => (
                  <button
                    key={s}
                    type="button"
                    onClick={() => setStartTime(s)}
                    className={`rounded border px-3 py-1.5 text-sm font-mono ${
                      startTime === s ? "border-gray-800 bg-gray-900 text-white" : "border-gray-200 hover:border-gray-400"
                    }`}
                  >
                    {s}
                  </button>
                ))}
              </div>
            ) : (
              <input
                type="time"
                value={startTime}
                onChange={(e) => setStartTime(e.target.value)}
                className="w-full rounded border border-gray-300 px-3 py-2 text-sm focus:border-gray-500 focus:outline-none"
              />
            )}
          </div>
        </div>

        <div className="rounded border border-gray-200 bg-white p-4">
          <label className="block text-xs font-medium text-gray-600 mb-1">Notes</label>
          <textarea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            rows={2}
            className="w-full rounded border border-gray-300 px-3 py-2 text-sm focus:border-gray-500 focus:outline-none"
            placeholder="Any special instructions…"
          />
        </div>

        {error && <p className="text-sm text-red-600">{error}</p>}

        <button
          type="submit"
          disabled={loading}
          className="w-full rounded bg-gray-900 px-4 py-2.5 text-sm font-medium text-white hover:bg-gray-800 disabled:opacity-50"
        >
          {loading ? "Booking…" : "Confirm Booking"}
        </button>
      </form>
    </div>
  );
}
