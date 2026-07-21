// ============================================================================
// MODULE : Worker Workspace — profile view
//
// The single-page worker profile: identity hero, headline KPIs, recent work +
// portfolio, services offered, and a right-hand "Profile Information" rail
// (status, specializations, languages, rating, certificates, assigned branches,
// availability). Presentational server component — every value comes from the
// one getWorkerWorkspace() fetch; nothing is queried or faked here.
// ============================================================================

import * as React from "react";
import Image from "next/image";
import {
  Star, Hash, MapPin, Languages, CalendarDays, CheckCircle2, Wallet, Users,
  BarChart3, ShieldAlert, Scissors, Award, Clock, Building2, Images as ImagesIcon,
} from "lucide-react";
import { Badge } from "@/components/shared/ui";
import { WorkerAvatar } from "@/components/workers/worker-ui";
import { formatDate } from "@/components/worker-profile/profile-ui";
import {
  AddPortfolioWorkButton,
  WorkerPhotoButton,
} from "@/components/worker-workspace/worker-image-actions";
import type { WorkerWorkspaceData } from "@/lib/worker-workspace";

const DAYS = [
  { i: 1, label: "Mon" }, { i: 2, label: "Tue" }, { i: 3, label: "Wed" },
  { i: 4, label: "Thu" }, { i: 5, label: "Fri" }, { i: 6, label: "Sat" }, { i: 0, label: "Sun" },
];

const STATUS_TONE: Record<string, "neutral" | "success" | "warning" | "danger" | "info" | "primary"> = {
  PENDING: "neutral", CONFIRMED: "info", CHECKED_IN: "warning", STARTED: "primary",
  COMPLETED: "success", CANCELLED: "danger", NO_SHOW: "danger", RESCHEDULED: "info",
};

function inr(n: number) {
  return `₹${Math.round(n).toLocaleString("en-IN")}`;
}
function compactInr(n: number) {
  if (n >= 100000) return `₹${(n / 100000).toFixed(2)}L`;
  if (n >= 1000) return `₹${(n / 1000).toFixed(1)}K`;
  return `₹${Math.round(n)}`;
}
function to12h(hhmm: string) {
  const [h, m] = hhmm.split(":").map(Number);
  const ap = h < 12 ? "AM" : "PM";
  const hr = h % 12 === 0 ? 12 : h % 12;
  return `${hr}:${String(m).padStart(2, "0")} ${ap}`;
}
function fullName(w: WorkerWorkspaceData["worker"]) {
  return w.displayName?.trim() || `${w.firstName} ${w.lastName}`.trim();
}

export function WorkerProfileView({ data }: { data: WorkerWorkspaceData }) {
  const { worker, primaryBranch, header, performance, attendance, portfolio, recentAppointments, availability } = data;
  const p = performance;
  const completedPct = p.totalAppointments > 0 ? ((p.completedBookings / p.totalAppointments) * 100).toFixed(1) : "0";
  const avail = new Map(availability.map((a) => [a.dayOfWeek, a]));

  const stats = [
    { label: "Total Appointments", value: p.totalAppointments.toLocaleString("en-IN"), hint: "All time", icon: CalendarDays, tint: "text-indigo-500 bg-indigo-50 dark:bg-indigo-500/10 dark:text-indigo-400" },
    { label: "Completed", value: p.completedBookings.toLocaleString("en-IN"), hint: `${completedPct}%`, icon: CheckCircle2, tint: "text-emerald-500 bg-emerald-50 dark:bg-emerald-500/10 dark:text-emerald-400" },
    { label: "Revenue Generated", value: compactInr(p.revenueGenerated), hint: "All time", icon: Wallet, tint: "text-violet-500 bg-violet-50 dark:bg-violet-500/10 dark:text-violet-400" },
    { label: "Repeat Customers", value: String(p.repeatCustomers), hint: "returning", icon: Users, tint: "text-sky-500 bg-sky-50 dark:bg-sky-500/10 dark:text-sky-400" },
    { label: "Attendance", value: attendance.attendancePct !== null ? `${attendance.attendancePct}%` : "—", hint: "this month", icon: BarChart3, tint: "text-amber-500 bg-amber-50 dark:bg-amber-500/10 dark:text-amber-400" },
    { label: "Cancellation Rate", value: `${p.cancellationRate}%`, hint: p.cancellationRate < 5 ? "Low" : "Watch", icon: ShieldAlert, tint: "text-rose-500 bg-rose-50 dark:bg-rose-500/10 dark:text-rose-400" },
  ];

  return (
    <div className="grid gap-5 lg:grid-cols-3">
      {/* ── Main column ─────────────────────────────────────────────── */}
      <div className="space-y-5 lg:col-span-2">
        {/* Hero */}
        <div className="rounded-2xl border border-gray-200 bg-white p-6 shadow-sm dark:border-[var(--sa-border)] dark:bg-[var(--sa-surface)]">
          <div className="flex flex-col gap-5 sm:flex-row">
            <div className="relative w-fit shrink-0">
              <WorkerAvatar firstName={worker.firstName} lastName={worker.lastName} photo={worker.profilePhoto} id={worker.id} size={104} />
              <WorkerPhotoButton workerId={worker.id} />
            </div>
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-2">
                <h1 className="text-2xl font-semibold tracking-tight text-gray-900 dark:text-[var(--sa-text)]">{fullName(worker)}</h1>
                <Badge tone={worker.isActive ? "success" : "danger"}>{worker.isActive ? "Active" : "Inactive"}</Badge>
              </div>
              {worker.designation?.name && (
                <p className="mt-0.5 text-sm font-medium text-indigo-600 dark:text-indigo-400">{worker.designation.name}</p>
              )}
              <p className="mt-1 inline-flex items-center gap-1 text-xs text-gray-400 dark:text-[var(--sa-muted)]">
                <Hash className="size-3" aria-hidden="true" />
                <span className="font-mono">Employee ID: {worker.employeeCode}</span>
              </p>

              <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-gray-500 dark:text-[var(--sa-text-2)]">
                <span className="inline-flex items-center gap-1 font-medium text-gray-700 dark:text-[var(--sa-text)]">
                  <Star className="size-4 fill-amber-400 text-amber-400" aria-hidden="true" />
                  {header.totalReviews > 0 ? header.averageRating.toFixed(1) : "—"}
                  <span className="font-normal text-gray-400 dark:text-[var(--sa-muted)]">({header.totalReviews} reviews)</span>
                </span>
                {worker.experience > 0 && (
                  <span className="inline-flex items-center gap-1"><Clock className="size-3.5" aria-hidden="true" />{worker.experience} years experience</span>
                )}
              </div>

              <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-gray-500 dark:text-[var(--sa-text-2)]">
                {primaryBranch && (
                  <span className="inline-flex items-center gap-1"><MapPin className="size-3.5" aria-hidden="true" />Primary Branch: {primaryBranch.name}{primaryBranch.city ? `, ${primaryBranch.city}` : ""}</span>
                )}
                {worker.languages.length > 0 && (
                  <span className="inline-flex items-center gap-1"><Languages className="size-3.5" aria-hidden="true" />{worker.languages.join(", ")}</span>
                )}
              </div>

              {worker.bio?.trim() && (
                <p className="mt-3 max-w-2xl text-sm leading-relaxed text-gray-600 dark:text-[var(--sa-text-2)]">{worker.bio}</p>
              )}
            </div>
          </div>
        </div>

        {/* Headline KPIs */}
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
          {stats.map((s) => (
            <div key={s.label} className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm dark:border-[var(--sa-border)] dark:bg-[var(--sa-surface)]">
              <div className="flex items-start justify-between">
                <p className="text-xs font-medium text-gray-500 dark:text-[var(--sa-text-2)]">{s.label}</p>
                <span className={`flex size-7 items-center justify-center rounded-lg ${s.tint}`}><s.icon className="size-4" aria-hidden="true" /></span>
              </div>
              <p className="mt-2 text-2xl font-semibold text-gray-900 dark:text-[var(--sa-text)]">{s.value}</p>
              <p className="mt-0.5 text-[11px] text-gray-400 dark:text-[var(--sa-muted)]">{s.hint}</p>
            </div>
          ))}
        </div>

        {/* Recent appointments + Portfolio */}
        <div className="grid gap-5 lg:grid-cols-2">
          <div className="rounded-2xl border border-gray-200 bg-white shadow-sm dark:border-[var(--sa-border)] dark:bg-[var(--sa-surface)]">
            <div className="flex items-center gap-2 border-b border-gray-100 px-5 py-3.5 dark:border-[var(--sa-border)]">
              <Users className="size-4 text-gray-400 dark:text-[var(--sa-muted)]" aria-hidden="true" />
              <h2 className="text-sm font-semibold text-gray-800 dark:text-[var(--sa-text)]">Recent Appointments</h2>
            </div>
            {recentAppointments.length === 0 ? (
              <p className="px-5 py-10 text-center text-sm text-gray-400 dark:text-[var(--sa-muted)]">No appointments yet.</p>
            ) : (
              <ul className="divide-y divide-gray-50 dark:divide-[var(--sa-border)]">
                {recentAppointments.map((a) => (
                  <li key={a.id} className="flex items-center justify-between gap-3 px-5 py-3">
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium text-gray-900 dark:text-[var(--sa-text)]">{a.customer.firstName} {a.customer.lastName}</p>
                      <p className="truncate text-xs text-gray-400 dark:text-[var(--sa-muted)]">
                        {a.services.map((s) => s.service.name).join(", ") || "—"} · {formatDate(a.appointmentDate)}
                      </p>
                    </div>
                    <div className="shrink-0 text-right">
                      <p className="text-sm font-medium text-gray-700 dark:text-[var(--sa-text-2)]">{inr(a.totalAmount)}</p>
                      <Badge tone={STATUS_TONE[a.status] ?? "neutral"}>{a.status.replace(/_/g, " ").toLowerCase()}</Badge>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </div>

          <div className="rounded-2xl border border-gray-200 bg-white shadow-sm dark:border-[var(--sa-border)] dark:bg-[var(--sa-surface)]">
            <div className="flex items-center gap-2 border-b border-gray-100 px-5 py-3.5 dark:border-[var(--sa-border)]">
              <ImagesIcon className="size-4 text-gray-400 dark:text-[var(--sa-muted)]" aria-hidden="true" />
              <h2 className="text-sm font-semibold text-gray-800 dark:text-[var(--sa-text)]">Portfolio</h2>
              <span className="text-xs text-gray-400 dark:text-[var(--sa-muted)]">{portfolio.items.length}</span>
              <AddPortfolioWorkButton workerId={worker.id} />
            </div>
            <div className="p-4">
              {portfolio.items.length === 0 ? (
                <p className="py-8 text-center text-sm text-gray-400 dark:text-[var(--sa-muted)]">No portfolio work yet.</p>
              ) : (
                <div className="grid grid-cols-3 gap-2">
                  {portfolio.items.slice(0, 8).map((it) => (
                    <div key={it.id} className="relative aspect-square overflow-hidden rounded-lg bg-gray-100 dark:bg-[var(--sa-hover)]">
                      <Image src={it.afterImage} alt={it.title ?? it.category} fill sizes="120px" className="object-cover" />
                      {!it.isApproved && (
                        <span className="absolute right-1 top-1 rounded-full bg-amber-500/90 px-1.5 py-0.5 text-[9px] font-medium text-white">Pending</span>
                      )}
                    </div>
                  ))}
                  {portfolio.items.length > 8 && (
                    <div className="flex aspect-square items-center justify-center rounded-lg border border-dashed border-gray-200 text-xs font-medium text-gray-400 dark:border-[var(--sa-border)] dark:text-[var(--sa-muted)]">
                      +{portfolio.items.length - 8} more
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Services offered */}
        <div className="rounded-2xl border border-gray-200 bg-white shadow-sm dark:border-[var(--sa-border)] dark:bg-[var(--sa-surface)]">
          <div className="flex items-center gap-2 border-b border-gray-100 px-5 py-3.5 dark:border-[var(--sa-border)]">
            <Scissors className="size-4 text-gray-400 dark:text-[var(--sa-muted)]" aria-hidden="true" />
            <h2 className="text-sm font-semibold text-gray-800 dark:text-[var(--sa-text)]">Services Offered</h2>
            <span className="ml-auto text-xs text-gray-400 dark:text-[var(--sa-muted)]">{worker.services.length}</span>
          </div>
          <div className="p-4">
            {worker.services.length === 0 ? (
              <p className="py-6 text-center text-sm text-gray-400 dark:text-[var(--sa-muted)]">No services assigned.</p>
            ) : (
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                {worker.services.map((ws) => (
                  <div key={ws.service.id} className="rounded-xl border border-gray-100 bg-gray-50/40 p-3 dark:border-[var(--sa-border)] dark:bg-[var(--sa-tile)]">
                    <span className="flex size-8 items-center justify-center rounded-lg bg-white text-gray-400 ring-1 ring-gray-200 dark:bg-[var(--sa-elevated)] dark:text-[var(--sa-text-2)] dark:ring-[var(--sa-border)]"><Scissors className="size-4" aria-hidden="true" /></span>
                    <p className="mt-2 truncate text-sm font-medium text-gray-900 dark:text-[var(--sa-text)]">{ws.service.name}</p>
                    <div className="mt-1 flex items-center justify-between text-xs text-gray-400 dark:text-[var(--sa-muted)]">
                      <span>{ws.service.duration} min</span>
                      <span className="font-semibold text-gray-700 dark:text-[var(--sa-text-2)]">{inr(ws.service.basePrice)}</span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* ── Right rail: Profile Information ─────────────────────────── */}
      <aside className="space-y-4">
        <div className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm dark:border-[var(--sa-border)] dark:bg-[var(--sa-surface)]">
          <h2 className="mb-4 text-sm font-semibold text-gray-800 dark:text-[var(--sa-text)]">Profile Information</h2>
          <dl className="space-y-3 text-sm">
            <Row label="Status" value={<Badge tone={worker.isActive ? "success" : "danger"}>{worker.isActive ? "Active" : "Inactive"}</Badge>} />
            <Row label="Book With Worker" value={<span className={worker.isPublic ? "font-medium text-emerald-600 dark:text-emerald-400" : "text-gray-500 dark:text-[var(--sa-muted)]"}>{worker.isPublic ? "Yes" : "No"}</span>} />
            <Row label="Designation" value={worker.designation?.name ?? "—"} />
            <Row label="Experience" value={`${worker.experience} ${worker.experience === 1 ? "Year" : "Years"}`} />
            <Row label="Rating" value={<span className="inline-flex items-center gap-1 font-medium text-gray-800 dark:text-[var(--sa-text)]"><Star className="size-3.5 fill-amber-400 text-amber-400" aria-hidden="true" />{header.totalReviews > 0 ? header.averageRating.toFixed(1) : "—"}</span>} />
            <Row label="Total Reviews" value={String(header.totalReviews)} />
          </dl>

          {worker.skills.length > 0 && (
            <div className="mt-4 border-t border-gray-100 pt-4 dark:border-[var(--sa-border)]">
              <p className="mb-2 text-xs font-medium uppercase tracking-wide text-gray-400 dark:text-[var(--sa-muted)]">Specializations</p>
              <div className="flex flex-wrap gap-1.5">
                {worker.skills.map((s) => (
                  <span key={s.skill.name} className="rounded-md bg-indigo-50 px-2 py-0.5 text-xs font-medium text-indigo-700 dark:bg-indigo-500/10 dark:text-indigo-300">{s.skill.name}</span>
                ))}
              </div>
            </div>
          )}

          {worker.languages.length > 0 && (
            <div className="mt-4 border-t border-gray-100 pt-4 dark:border-[var(--sa-border)]">
              <p className="mb-2 text-xs font-medium uppercase tracking-wide text-gray-400 dark:text-[var(--sa-muted)]">Languages</p>
              <p className="text-sm text-gray-700 dark:text-[var(--sa-text-2)]">{worker.languages.join(", ")}</p>
            </div>
          )}
        </div>

        {/* Certificates */}
        {worker.certificates.length > 0 && (
          <div className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm dark:border-[var(--sa-border)] dark:bg-[var(--sa-surface)]">
            <p className="mb-3 flex items-center gap-2 text-sm font-semibold text-gray-800 dark:text-[var(--sa-text)]"><Award className="size-4 text-gray-400 dark:text-[var(--sa-muted)]" aria-hidden="true" /> Certificates</p>
            <ul className="space-y-2">
              {worker.certificates.map((c, i) => (
                <li key={`${c}-${i}`} className="flex items-start gap-2 text-sm text-gray-700 dark:text-[var(--sa-text-2)]">
                  <Award className="mt-0.5 size-3.5 shrink-0 text-gray-300 dark:text-[var(--sa-muted)]" aria-hidden="true" />
                  <span className="min-w-0">{c}</span>
                </li>
              ))}
            </ul>
          </div>
        )}

        {/* Assigned branches */}
        <div className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm dark:border-[var(--sa-border)] dark:bg-[var(--sa-surface)]">
          <p className="mb-3 flex items-center gap-2 text-sm font-semibold text-gray-800 dark:text-[var(--sa-text)]"><Building2 className="size-4 text-gray-400 dark:text-[var(--sa-muted)]" aria-hidden="true" /> Assigned Branches</p>
          <div className="space-y-2">
            {worker.branches.filter((b) => b.isActive).map((wb) => (
              <div key={wb.branch.id} className="rounded-xl border border-gray-100 bg-gray-50/40 p-3 dark:border-[var(--sa-border)] dark:bg-[var(--sa-tile)]">
                <div className="flex items-center justify-between gap-2">
                  <p className="truncate text-sm font-medium text-gray-900 dark:text-[var(--sa-text)]">{wb.branch.name}</p>
                  {wb.isPrimary && <Badge tone="success">Primary</Badge>}
                </div>
                {wb.branch.city && <p className="text-xs text-gray-400 dark:text-[var(--sa-muted)]">{wb.branch.city}</p>}
                <div className="mt-2 flex items-center justify-between text-[11px] text-gray-400 dark:text-[var(--sa-muted)]">
                  <span>Services · {worker.services.length}</span>
                  <span>Joined {formatDate(worker.joinDate)}</span>
                </div>
              </div>
            ))}
            {worker.branches.filter((b) => b.isActive).length === 0 && (
              <p className="text-sm text-gray-400 dark:text-[var(--sa-muted)]">No branches assigned.</p>
            )}
          </div>
        </div>

        {/* Availability */}
        <div className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm dark:border-[var(--sa-border)] dark:bg-[var(--sa-surface)]">
          <p className="mb-3 flex items-center gap-2 text-sm font-semibold text-gray-800 dark:text-[var(--sa-text)]"><Clock className="size-4 text-gray-400 dark:text-[var(--sa-muted)]" aria-hidden="true" /> Availability</p>
          {availability.length === 0 ? (
            <p className="text-sm text-gray-400 dark:text-[var(--sa-muted)]">No hours configured.</p>
          ) : (
            <dl className="space-y-1.5 text-sm">
              {DAYS.map((d) => {
                const t = avail.get(d.i);
                const open = t?.isOpen;
                return (
                  <div key={d.i} className="flex items-center justify-between">
                    <dt className="text-gray-500 dark:text-[var(--sa-text-2)]">{d.label}</dt>
                    <dd className={open ? "font-medium text-gray-700 dark:text-[var(--sa-text)]" : "font-medium text-rose-500 dark:text-rose-400"}>
                      {open && t ? `${to12h(t.openTime)} – ${to12h(t.closeTime)}` : "Off"}
                    </dd>
                  </div>
                );
              })}
            </dl>
          )}
          <p className="mt-3 text-[11px] text-gray-400 dark:text-[var(--sa-muted)]">Branch operating hours.</p>
        </div>
      </aside>
    </div>
  );
}

function Row({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-3">
      <dt className="text-gray-500 dark:text-[var(--sa-text-2)]">{label}</dt>
      <dd className="text-right text-gray-800 dark:text-[var(--sa-text)]">{value}</dd>
    </div>
  );
}
