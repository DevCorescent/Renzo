"use client";

import * as React from "react";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { API } from "@/lib/endpoints";
import {
  MapPin, Scissors, Clock, ChevronLeft, ChevronRight, Check,
  Loader2, CalendarDays, X,
} from "lucide-react";

/* ── shared types (exported for use in server page) ────────────────────────── */

export type PreloadedBranch = {
  id: string; name: string; slug: string; city: string;
  address: string; coverImage: string | null;
};
export type PreloadedService = {
  id: string; name: string; image: string | null;
  duration: number; gender: string; basePrice: number;
  category: { name: string }; price: number;
};

type ApiBranch = PreloadedBranch;
type ApiService = {
  id: string; name: string; image: string | null;
  duration: number; gender: string; basePrice: number;
  category: { name: string }; branchPricings?: { price: number }[];
};

/* ── helpers ────────────────────────────────────────────────────────────────── */

function today() { return new Date().toISOString().slice(0, 10); }
function addDays(base: string, n: number) {
  const d = new Date(base); d.setDate(d.getDate() + n);
  return d.toISOString().slice(0, 10);
}
function endTime(start: string, mins: number) {
  const [h, m] = start.split(":").map(Number);
  const t = h * 60 + m + mins;
  return `${String(Math.floor(t / 60)).padStart(2, "0")}:${String(t % 60).padStart(2, "0")}`;
}
function fmtDate(iso: string) {
  return new Date(iso).toLocaleDateString("en-IN", {
    weekday: "long", day: "numeric", month: "long", year: "numeric",
  });
}

const DATE_COUNT = 14;

/* ── top booking bar: shows selections made so far ──────────────────────────── */

function BookingBar({
  branch, service, date, slot,
  onChangeBranch, onChangeService, onChangeSlot,
}: {
  branch: PreloadedBranch | null;
  service: PreloadedService | null;
  date: string; slot: string;
  onChangeBranch: () => void;
  onChangeService: () => void;
  onChangeSlot: () => void;
}) {
  if (!branch && !service) return null;
  return (
    <div className="mb-6 flex flex-wrap items-center gap-2 rounded-2xl border border-white/8 bg-stone-900/80 p-3">
      {branch && (
        <button
          onClick={onChangeBranch}
          className="group flex items-center gap-2 rounded-xl bg-stone-800 px-3 py-2 text-left transition hover:bg-stone-700"
        >
          <MapPin className="size-3.5 shrink-0 text-amber-400" />
          <span className="text-xs font-medium text-stone-200">{branch.name}</span>
          <X className="size-3 text-stone-600 group-hover:text-red-400 transition" />
        </button>
      )}
      {service && (
        <button
          onClick={onChangeService}
          className="group flex items-center gap-2 rounded-xl bg-stone-800 px-3 py-2 text-left transition hover:bg-stone-700"
        >
          <Scissors className="size-3.5 shrink-0 text-amber-400" />
          <span className="text-xs font-medium text-stone-200">{service.name}</span>
          <span className="text-xs text-amber-400 font-semibold">₹{service.price.toLocaleString("en-IN")}</span>
          <X className="size-3 text-stone-600 group-hover:text-red-400 transition" />
        </button>
      )}
      {slot && (
        <button
          onClick={onChangeSlot}
          className="group flex items-center gap-2 rounded-xl bg-stone-800 px-3 py-2 text-left transition hover:bg-stone-700"
        >
          <Clock className="size-3.5 shrink-0 text-amber-400" />
          <span className="text-xs font-medium text-stone-200">{fmtDate(date).split(",")[0]}, {slot}</span>
          <X className="size-3 text-stone-600 group-hover:text-red-400 transition" />
        </button>
      )}
    </div>
  );
}

/* ── step indicator ─────────────────────────────────────────────────────────── */

type Step = "branch" | "service" | "slot" | "confirm";
const STEPS: { key: Step; label: string }[] = [
  { key: "branch", label: "Branch" },
  { key: "service", label: "Service" },
  { key: "slot", label: "Date & Time" },
  { key: "confirm", label: "Confirm" },
];

function StepBar({ current }: { current: Step }) {
  const idx = STEPS.findIndex((s) => s.key === current);
  return (
    <div className="mb-8 flex items-center gap-1">
      {STEPS.map((s, i) => (
        <React.Fragment key={s.key}>
          <div className="flex items-center gap-1.5">
            <span className={`inline-flex size-6 items-center justify-center rounded-full text-xs font-bold transition-colors ${
              i < idx ? "bg-emerald-500 text-white" :
              i === idx ? "bg-amber-500 text-stone-950" :
              "bg-stone-800 text-stone-500"
            }`}>
              {i < idx ? <Check className="size-3.5" /> : i + 1}
            </span>
            <span className={`hidden text-xs font-medium sm:inline ${
              i === idx ? "text-amber-400" : i < idx ? "text-emerald-400" : "text-stone-600"
            }`}>
              {s.label}
            </span>
          </div>
          {i < STEPS.length - 1 && (
            <div className={`h-px flex-1 transition-colors ${i < idx ? "bg-emerald-500/40" : "bg-stone-800"}`} />
          )}
        </React.Fragment>
      ))}
    </div>
  );
}

/* ── step 1: branch ─────────────────────────────────────────────────────────── */

function BranchStep({ onSelect }: { onSelect: (b: ApiBranch) => void }) {
  const [branches, setBranches] = React.useState<ApiBranch[]>([]);
  const [loading, setLoading] = React.useState(true);

  React.useEffect(() => {
    fetch(`${API.public.branches}?limit=50`)
      .then((r) => r.json())
      .then((j) => setBranches(j.data?.items ?? j.data ?? []))
      .finally(() => setLoading(false));
  }, []);

  return (
    <div>
      <h2 className="mb-1 text-lg font-semibold">Choose a branch</h2>
      <p className="mb-5 text-sm text-stone-400">Pick the salon location nearest to you</p>
      {loading ? (
        <div className="flex justify-center py-16"><Loader2 className="size-6 animate-spin text-stone-600" /></div>
      ) : branches.length === 0 ? (
        <p className="py-16 text-center text-stone-500">No branches available yet.</p>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2">
          {branches.map((b) => (
            <button
              key={b.id}
              onClick={() => onSelect(b)}
              className="group flex items-center gap-3 overflow-hidden rounded-2xl border border-white/8 bg-stone-900 text-left transition hover:border-amber-500/40 hover:bg-stone-800"
            >
              <div className="relative size-20 shrink-0 overflow-hidden bg-stone-800">
                {b.coverImage
                  ? <Image src={b.coverImage} alt={b.name} fill className="object-cover opacity-80 transition group-hover:opacity-100" sizes="80px" />
                  : <div className="flex size-full items-center justify-center text-stone-700 text-xl font-bold opacity-30">{b.name[0]}</div>
                }
              </div>
              <div className="min-w-0 flex-1 py-3 pr-4">
                <p className="font-semibold text-stone-100 group-hover:text-amber-400 transition">{b.name}</p>
                <p className="mt-0.5 flex items-center gap-1 text-xs text-stone-500">
                  <MapPin className="size-3 shrink-0" />{b.city} — {b.address}
                </p>
              </div>
              <ChevronRight className="mr-3 size-4 text-stone-600 group-hover:text-amber-400 transition" />
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

/* ── step 2: service ─────────────────────────────────────────────────────────── */

function ServiceStep({ branchId, onSelect }: { branchId: string; onSelect: (s: PreloadedService) => void }) {
  const [services, setServices] = React.useState<ApiService[]>([]);
  const [loading, setLoading] = React.useState(true);

  React.useEffect(() => {
    setLoading(true);
    fetch(`${API.public.services}?branchId=${branchId}&limit=100`)
      .then((r) => r.json())
      .then((j) => setServices(j.data?.items ?? j.data ?? []))
      .finally(() => setLoading(false));
  }, [branchId]);

  // Group by category
  const grouped = services.reduce<Record<string, { name: string; items: ApiService[] }>>((acc, s) => {
    const cat = s.category.name;
    if (!acc[cat]) acc[cat] = { name: cat, items: [] };
    acc[cat].items.push(s);
    return acc;
  }, {});

  return (
    <div>
      <h2 className="mb-1 text-lg font-semibold">Select a service</h2>
      <p className="mb-5 text-sm text-stone-400">What would you like today?</p>
      {loading ? (
        <div className="flex justify-center py-16"><Loader2 className="size-6 animate-spin text-stone-600" /></div>
      ) : services.length === 0 ? (
        <p className="py-16 text-center text-stone-500">No services listed at this branch yet.</p>
      ) : (
        <div className="space-y-5">
          {Object.values(grouped).map(({ name: cat, items }) => (
            <div key={cat}>
              <p className="mb-2 text-[10px] font-bold uppercase tracking-widest text-stone-500">{cat}</p>
              <div className="divide-y divide-white/5 overflow-hidden rounded-2xl border border-white/8 bg-stone-900">
                {items.map((s) => {
                  const price = s.branchPricings?.[0]?.price ?? s.basePrice;
                  return (
                    <button
                      key={s.id}
                      onClick={() => onSelect({ ...s, price })}
                      className="group flex w-full items-center gap-3 px-4 py-3.5 text-left transition hover:bg-white/4"
                    >
                      {s.image ? (
                        <Image src={s.image} alt={s.name} width={44} height={44}
                          className="size-11 shrink-0 rounded-xl object-cover" />
                      ) : (
                        <div className="flex size-11 shrink-0 items-center justify-center rounded-xl bg-stone-800">
                          <Scissors className="size-4 text-stone-600" />
                        </div>
                      )}
                      <div className="min-w-0 flex-1">
                        <p className="font-medium text-stone-100 group-hover:text-amber-400 transition">{s.name}</p>
                        <p className="text-xs text-stone-500">{s.duration} min</p>
                      </div>
                      <div className="text-right">
                        <p className="font-semibold text-amber-400">₹{price.toLocaleString("en-IN")}</p>
                        <ChevronRight className="ml-auto mt-0.5 size-3.5 text-stone-700 group-hover:text-amber-400 transition" />
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

/* ── step 3: date + slot ────────────────────────────────────────────────────── */

function SlotStep({
  branchId, serviceId,
  onSelect,
}: {
  branchId: string; serviceId: string;
  onSelect: (date: string, slot: string) => void;
}) {
  const dates = React.useMemo(() => Array.from({ length: DATE_COUNT }, (_, i) => addDays(today(), i)), []);
  const [selectedDate, setSelectedDate] = React.useState(dates[0]);
  const [slots, setSlots] = React.useState<string[]>([]);
  const [loading, setLoading] = React.useState(false);
  const [msg, setMsg] = React.useState<string | null>(null);

  React.useEffect(() => {
    setSlots([]); setMsg(null); setLoading(true);
    fetch(`${API.public.slots}?branchId=${branchId}&serviceId=${serviceId}&date=${selectedDate}`)
      .then((r) => r.json())
      .then((j) => {
        setSlots(j.data?.slots ?? []);
        if (!j.success) setMsg(j.message ?? "Could not load slots");
        else if ((j.data?.slots ?? []).length === 0) setMsg("No slots available — try another date");
      })
      .catch(() => setMsg("Failed to load slots"))
      .finally(() => setLoading(false));
  }, [branchId, serviceId, selectedDate]);

  return (
    <div>
      <h2 className="mb-1 text-lg font-semibold">Pick a date & time</h2>
      <p className="mb-5 text-sm text-stone-400">Choose when you'd like to come in</p>

      {/* Horizontal date scroller */}
      <div className="mb-6 flex gap-2 overflow-x-auto pb-1">
        {dates.map((d) => {
          const dt = new Date(d);
          const isToday = d === today();
          return (
            <button
              key={d}
              onClick={() => setSelectedDate(d)}
              className={`flex shrink-0 flex-col items-center rounded-2xl border px-3.5 py-2.5 text-center transition ${
                selectedDate === d
                  ? "border-amber-500 bg-amber-500/10 text-amber-400"
                  : "border-white/8 bg-stone-900 text-stone-400 hover:border-white/15 hover:text-stone-200"
              }`}
            >
              <span className="text-[10px] font-medium uppercase tracking-wide">
                {isToday ? "Today" : dt.toLocaleDateString("en-IN", { weekday: "short" })}
              </span>
              <span className="mt-0.5 text-xl font-bold leading-tight">{dt.getDate()}</span>
              <span className="text-[10px] text-stone-500">{dt.toLocaleDateString("en-IN", { month: "short" })}</span>
            </button>
          );
        })}
      </div>

      {/* Slots grid */}
      <p className="mb-3 text-xs font-semibold uppercase tracking-widest text-stone-500">
        <CalendarDays className="mr-1 inline size-3.5" />
        {fmtDate(selectedDate)}
      </p>

      {loading ? (
        <div className="flex justify-center py-12"><Loader2 className="size-5 animate-spin text-stone-600" /></div>
      ) : msg ? (
        <p className="py-10 text-center text-sm text-stone-500">{msg}</p>
      ) : (
        <div className="grid grid-cols-4 gap-2 sm:grid-cols-5 lg:grid-cols-6">
          {slots.map((slot) => (
            <button
              key={slot}
              onClick={() => onSelect(selectedDate, slot)}
              className="rounded-xl border border-white/8 bg-stone-900 py-3 text-center text-sm font-medium text-stone-300 transition hover:border-amber-500/50 hover:bg-amber-500/10 hover:text-amber-400"
            >
              {slot}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

/* ── step 4: confirm ────────────────────────────────────────────────────────── */

function ConfirmStep({
  branch, service, date, slot, notes,
  onNotes, onConfirm, loading, error,
}: {
  branch: PreloadedBranch; service: PreloadedService;
  date: string; slot: string; notes: string;
  onNotes: (v: string) => void;
  onConfirm: () => void;
  loading: boolean; error: string | null;
}) {
  const end = endTime(slot, service.duration);
  return (
    <div>
      <h2 className="mb-1 text-lg font-semibold">Confirm booking</h2>
      <p className="mb-5 text-sm text-stone-400">Review your appointment details below</p>

      {/* Summary card */}
      <div className="mb-5 overflow-hidden rounded-2xl border border-white/8 bg-stone-900">
        {/* Branch banner */}
        <div className="relative h-24 w-full overflow-hidden bg-stone-800">
          {branch.coverImage && (
            <Image src={branch.coverImage} alt={branch.name} fill className="object-cover opacity-50" sizes="100vw" />
          )}
          <div className="absolute inset-0 bg-gradient-to-t from-stone-900 via-transparent to-transparent" />
          <div className="absolute bottom-3 left-4">
            <p className="text-xs text-stone-400">Branch</p>
            <p className="font-semibold text-stone-100">{branch.name} · {branch.city}</p>
          </div>
        </div>

        <div className="divide-y divide-white/5 px-4">
          <Row label="Service">
            <span className="font-medium text-stone-200">{service.name}</span>
          </Row>
          <Row label="Date">
            <span className="font-medium text-stone-200">{fmtDate(date)}</span>
          </Row>
          <Row label="Time">
            <span className="font-medium text-stone-200">{slot} – {end} <span className="text-stone-500">({service.duration} min)</span></span>
          </Row>
          <Row label="Amount" highlight>
            <span className="text-lg font-bold text-amber-400">₹{service.price.toLocaleString("en-IN")}</span>
          </Row>
        </div>
      </div>

      {/* Notes */}
      <textarea
        value={notes}
        onChange={(e) => onNotes(e.target.value)}
        placeholder="Any special requests? (optional)"
        rows={2}
        className="mb-4 w-full resize-none rounded-2xl border border-white/8 bg-stone-900 px-4 py-3 text-sm text-stone-200 placeholder:text-stone-600 focus:border-amber-500/40 focus:outline-none"
      />

      {error && (
        <div className="mb-4 rounded-2xl border border-red-500/20 bg-red-500/10 px-4 py-3 text-sm text-red-400">
          {error}
        </div>
      )}

      <button
        onClick={onConfirm}
        disabled={loading}
        className="flex w-full items-center justify-center gap-2 rounded-2xl bg-amber-500 py-4 text-base font-bold text-stone-950 transition hover:bg-amber-400 active:scale-[0.98] disabled:opacity-60"
      >
        {loading && <Loader2 className="size-4 animate-spin" />}
        {loading ? "Booking…" : "Confirm Appointment →"}
      </button>
      <p className="mt-3 text-center text-xs text-stone-600">Pay at the salon · Free cancellation</p>
    </div>
  );
}

function Row({ label, children, highlight }: { label: string; children: React.ReactNode; highlight?: boolean }) {
  return (
    <div className={`flex items-center justify-between py-3 ${highlight ? "bg-transparent" : ""}`}>
      <span className="text-sm text-stone-500">{label}</span>
      <div className="text-right">{children}</div>
    </div>
  );
}

/* ── main wizard ────────────────────────────────────────────────────────────── */

export function BookWizard({
  initialBranch,
  initialService,
}: {
  initialBranch: PreloadedBranch | null;
  initialService: PreloadedService | null;
}) {
  const router = useRouter();

  // Determine initial step based on what was pre-loaded server-side
  const initStep: Step =
    initialBranch && initialService ? "slot"
    : initialBranch ? "service"
    : "branch";

  const [step, setStep] = React.useState<Step>(initStep);
  const [branch, setBranch] = React.useState<PreloadedBranch | null>(initialBranch);
  const [service, setService] = React.useState<PreloadedService | null>(initialService);
  const [date, setDate] = React.useState("");
  const [slot, setSlot] = React.useState("");
  const [notes, setNotes] = React.useState("");
  const [confirmLoading, setConfirmLoading] = React.useState(false);
  const [confirmError, setConfirmError] = React.useState<string | null>(null);

  async function handleConfirm() {
    if (!branch || !service || !date || !slot) return;
    setConfirmLoading(true); setConfirmError(null);
    try {
      const res = await fetch(API.customer.appointments, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          branchId: branch.id,
          services: [{ serviceId: service.id }],
          appointmentDate: date,
          startTime: slot,
          endTime: endTime(slot, service.duration),
          notes: notes.trim() || undefined,
        }),
      });
      const json = await res.json();
      if (res.status === 401) {
        router.push(`/login?redirect=${encodeURIComponent("/customer/bookings")}`);
        return;
      }
      if (!res.ok) throw new Error(json?.error ?? json?.message ?? "Booking failed");
      router.push(`/customer/bookings/${json.data?.id ?? ""}`);
    } catch (e) {
      setConfirmError(e instanceof Error ? e.message : "Booking failed. Please try again.");
    } finally {
      setConfirmLoading(false);
    }
  }

  return (
    <div className="min-h-screen bg-stone-950 text-stone-100">
      <div className="mx-auto max-w-2xl px-4 py-10 sm:px-6">
        <StepBar current={step} />

        <BookingBar
          branch={branch} service={service} date={date} slot={slot}
          onChangeBranch={() => { setBranch(null); setService(null); setDate(""); setSlot(""); setStep("branch"); }}
          onChangeService={() => { setService(null); setDate(""); setSlot(""); setStep("service"); }}
          onChangeSlot={() => { setDate(""); setSlot(""); setStep("slot"); }}
        />

        {step === "branch" && (
          <BranchStep
            onSelect={(b) => {
              setBranch(b); setService(null); setDate(""); setSlot("");
              setStep("service");
            }}
          />
        )}

        {step === "service" && branch && (
          <>
            <button
              onClick={() => { setBranch(null); setStep("branch"); }}
              className="mb-4 flex items-center gap-1.5 text-sm text-stone-500 hover:text-stone-300 transition"
            >
              <ChevronLeft className="size-4" /> Change branch
            </button>
            <ServiceStep
              branchId={branch.id}
              onSelect={(s) => { setService(s); setDate(""); setSlot(""); setStep("slot"); }}
            />
          </>
        )}

        {step === "slot" && branch && service && (
          <>
            <button
              onClick={() => { setDate(""); setSlot(""); setStep("service"); }}
              className="mb-4 flex items-center gap-1.5 text-sm text-stone-500 hover:text-stone-300 transition"
            >
              <ChevronLeft className="size-4" /> Change service
            </button>
            <SlotStep
              branchId={branch.id}
              serviceId={service.id}
              onSelect={(d, s) => { setDate(d); setSlot(s); setStep("confirm"); }}
            />
          </>
        )}

        {step === "confirm" && branch && service && date && slot && (
          <>
            <button
              onClick={() => { setDate(""); setSlot(""); setStep("slot"); }}
              className="mb-4 flex items-center gap-1.5 text-sm text-stone-500 hover:text-stone-300 transition"
            >
              <ChevronLeft className="size-4" /> Change time
            </button>
            <ConfirmStep
              branch={branch} service={service} date={date} slot={slot}
              notes={notes} onNotes={setNotes}
              onConfirm={handleConfirm}
              loading={confirmLoading} error={confirmError}
            />
          </>
        )}
      </div>
    </div>
  );
}
