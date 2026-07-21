// ============================================================================
// OWNER  : Gauransh
// MODULE : Worker Workspace — tab panels
//
// The read-only panels of the workspace. Each renders a slice of the single
// workspace fetch — no panel queries anything. They REUSE the existing profile
// primitives (ProfileSection / Field / FieldGrid) and the shared StatCard, so the
// workspace speaks the same visual language as the rest of the app and duplicates
// no layout.
//
// HONEST LIMITS (schema-bound, not faked):
//   • Documents shows only WorkerProfile.certificates — there is no document model
//     for government IDs / joining papers, so those are absent, not invented.
//   • Activity shows only what AuditLog captured for this worker; events no module
//     audits simply do not appear.
// ============================================================================

import * as React from "react";
import Image from "next/image";
import {
  Star, CheckCircle2, Wallet, Users, Percent, CalendarCheck, Award, Scissors,
  FileText, GraduationCap, History, ImageOff, Clock,
} from "lucide-react";
import { Badge, StatCard, Card, CardHeader, CardTitle, Table, THead, TH, TR, TD } from "@/components/shared/ui";
import { ProfileSection, Field, FieldGrid, formatDate } from "@/components/worker-profile/profile-ui";
import type { WorkerWorkspaceData } from "@/lib/worker-workspace";
import { WorkerServicesManager } from "./worker-services-manager";

const LEVELS = ["New", "Skilled", "Proficient", "Advanced", "Expert", "Master"];
const money = (n: number) => `₹${Math.round(n).toLocaleString("en-IN")}`;

/* ─── Overview ─────────────────────────────────────────────────────────────── */
export function OverviewTab({ data }: { data: WorkerWorkspaceData }) {
  const { worker, primaryBranch } = data;
  return (
    <div className="space-y-4">
      <ProfileSection title="Personal">
        <FieldGrid>
          <Field label="Gender" value={worker.gender} />
          <Field label="Phone" value={worker.phone} />
          <Field label="Email" value={worker.email} />
          <Field label="Date of birth" value={worker.dateOfBirth ? formatDate(worker.dateOfBirth) : null} />
          <Field label="Languages" value={worker.languages.length ? worker.languages.join(", ") : null} />
        </FieldGrid>
        {worker.bio?.trim() && (
          <div className="mt-3 rounded-lg border border-gray-100 bg-gray-50/40 p-3 dark:border-[var(--sa-border)] dark:bg-[var(--sa-tile)]">
            <dt className="text-[11px] font-medium uppercase tracking-wide text-gray-400 dark:text-[var(--sa-muted)]">Bio</dt>
            <dd className="mt-1 text-sm leading-relaxed text-gray-700 dark:text-[var(--sa-text-2)]">{worker.bio}</dd>
          </div>
        )}
      </ProfileSection>

      <ProfileSection title="Employment">
        <FieldGrid>
          <Field label="Employee code" value={<span className="font-mono">{worker.employeeCode}</span>} />
          <Field label="Department" value={worker.department?.name} />
          <Field label="Designation" value={worker.designation?.name} />
          <Field label="Experience" value={`${worker.experience} ${worker.experience === 1 ? "year" : "years"}`} />
          <Field label="Joining date" value={formatDate(worker.joinDate)} />
          <Field label="Primary branch" value={primaryBranch?.name} />
          <Field
            label="Status"
            value={<Badge tone={worker.isActive ? "success" : "danger"}>{worker.isActive ? "Active" : "Inactive"}</Badge>}
          />
          <Field
            label="Public profile"
            value={<Badge tone={worker.isPublic ? "info" : "neutral"}>{worker.isPublic ? "Visible" : "Hidden"}</Badge>}
          />
        </FieldGrid>
      </ProfileSection>
    </div>
  );
}

/* ─── Portfolio ────────────────────────────────────────────────────────────── */
export function PortfolioTab({ data }: { data: WorkerWorkspaceData }) {
  const { worker, portfolio, header } = data;
  const rc = portfolio.requestCounts;
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <StatCard label="Completion" value={`${header.portfolioCompletion}%`} />
        <StatCard label="Pending requests" value={String(rc.PENDING)} />
        <StatCard label="Approved" value={String(rc.APPROVED)} />
        <StatCard label="Needs changes" value={String(rc.NEEDS_CHANGES + rc.REJECTED)} />
      </div>

      {worker.skills.length > 0 && (
        <ProfileSection title="Skills">
          <div className="grid gap-3 sm:grid-cols-2">
            {worker.skills.map((s) => (
              <div key={s.skill.name} className="rounded-lg border border-gray-100 p-3 dark:border-[var(--sa-border)] dark:bg-[var(--sa-tile)]">
                <div className="flex items-center justify-between">
                  <p className="text-sm font-medium text-gray-800 dark:text-[var(--sa-text)]">{s.skill.name}</p>
                  <Badge tone="neutral">{LEVELS[Math.max(0, Math.min(5, s.proficiency))]}</Badge>
                </div>
                <div className="mt-2 flex items-center gap-1" aria-label={`Proficiency ${s.proficiency} of 5`}>
                  {[1, 2, 3, 4, 5].map((i) => (
                    <span key={i} className={`h-1.5 flex-1 rounded-full ${i <= s.proficiency ? "bg-gray-800 dark:bg-[var(--sa-text-2)]" : "bg-gray-100 dark:bg-[var(--sa-hover)]"}`} />
                  ))}
                </div>
              </div>
            ))}
          </div>
        </ProfileSection>
      )}

      <ProfileSection title="Gallery" bodyClassName={portfolio.items.length ? undefined : "p-4"}>
        {portfolio.items.length === 0 ? (
          <EmptyInline icon={ImageOff} label="No portfolio work yet" />
        ) : (
          <div className="grid grid-cols-3 gap-2 sm:grid-cols-4">
            {portfolio.items.map((it) => (
              <div key={it.id} className="relative aspect-square overflow-hidden rounded-lg bg-gray-100 dark:bg-[var(--sa-hover)]">
                <Image src={it.afterImage} alt={it.title ?? it.category} fill sizes="120px" className="object-cover" />
                {!it.isApproved && (
                  <span className="absolute right-1 top-1 rounded-full bg-amber-500/90 px-1.5 py-0.5 text-[9px] font-medium text-white">Pending</span>
                )}
              </div>
            ))}
          </div>
        )}
      </ProfileSection>
    </div>
  );
}

/* ─── Attendance ───────────────────────────────────────────────────────────── */
const ATT_TONE: Record<string, "neutral" | "success" | "warning" | "danger" | "info"> = {
  PRESENT: "success", LATE: "warning", ABSENT: "danger", HALF_DAY: "info", ON_LEAVE: "neutral",
};

export function AttendanceTab({ data }: { data: WorkerWorkspaceData }) {
  const a = data.attendance;
  if (a.marked === 0) return <EmptyState icon={CalendarCheck} title="No attendance recorded this month" />;
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <StatCard label="Attendance" value={a.attendancePct !== null ? `${a.attendancePct}%` : "—"} icon={Percent} />
        <StatCard label="Working hours" value={`${a.workingHours} h`} icon={Clock} />
        <StatCard label="Overtime" value={`${a.overtimeHours} h`} />
        <StatCard label="Late days" value={String(a.lateCount)} />
      </div>
      <Card>
        <CardHeader><CardTitle>This month</CardTitle></CardHeader>
        <Table>
          <THead><tr><TH>Date</TH><TH>Status</TH><TH>Working</TH><TH>Late</TH></tr></THead>
          <tbody>
            {a.rows.map((r) => (
              <TR key={r.date.toISOString()}>
                <TD className="whitespace-nowrap text-xs text-gray-600 dark:text-[var(--sa-text-2)]">{formatDate(r.date)}</TD>
                <TD><Badge tone={ATT_TONE[r.status] ?? "neutral"}>{r.status.replace(/_/g, " ")}</Badge></TD>
                <TD className="text-xs text-gray-500 dark:text-[var(--sa-muted)]">{Math.round((r.workingMinutes / 60) * 10) / 10} h</TD>
                <TD className="text-xs text-gray-500 dark:text-[var(--sa-muted)]">{r.lateMinutes > 0 ? `${r.lateMinutes} min` : "—"}</TD>
              </TR>
            ))}
          </tbody>
        </Table>
      </Card>
    </div>
  );
}

/* ─── Leaves ───────────────────────────────────────────────────────────────── */
export function LeavesTab({ data }: { data: WorkerWorkspaceData }) {
  const { counts, balances, rows } = data.leaves;
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <StatCard label="Pending" value={String(counts.PENDING)} />
        <StatCard label="Approved" value={String(counts.APPROVED)} />
        <StatCard label="Rejected" value={String(counts.REJECTED)} />
        <StatCard label="Cancelled" value={String(counts.CANCELLED)} />
      </div>

      {balances.length > 0 && (
        <ProfileSection title="Leave balance">
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {balances.map((b) => (
              <div key={b.leaveType.code} className="rounded-lg border border-gray-100 p-3 dark:border-[var(--sa-border)] dark:bg-[var(--sa-tile)]">
                <p className="text-xs font-medium text-gray-500 dark:text-[var(--sa-text-2)]">{b.leaveType.name} ({b.leaveType.code})</p>
                <p className="mt-1 text-lg font-semibold text-gray-900 dark:text-[var(--sa-text)]">{b.remaining}</p>
                <p className="text-[11px] text-gray-400 dark:text-[var(--sa-muted)]">of {b.allocated} · {b.used} used</p>
              </div>
            ))}
          </div>
        </ProfileSection>
      )}

      <Card>
        <CardHeader><CardTitle>History</CardTitle></CardHeader>
        {rows.length === 0 ? (
          <EmptyInline icon={CalendarCheck} label="No leave requests" />
        ) : (
          <Table>
            <THead><tr><TH>Type</TH><TH>From</TH><TH>To</TH><TH>Days</TH><TH>Status</TH></tr></THead>
            <tbody>
              {rows.map((l) => (
                <TR key={l.id}>
                  <TD className="text-gray-700 dark:text-[var(--sa-text)]">{l.leaveType.name}</TD>
                  <TD className="whitespace-nowrap text-xs text-gray-600 dark:text-[var(--sa-text-2)]">{formatDate(l.startDate)}</TD>
                  <TD className="whitespace-nowrap text-xs text-gray-600 dark:text-[var(--sa-text-2)]">{formatDate(l.endDate)}</TD>
                  <TD className="text-gray-500 dark:text-[var(--sa-muted)]">{l.days}</TD>
                  <TD>
                    <Badge tone={l.status === "APPROVED" ? "success" : l.status === "REJECTED" ? "danger" : l.status === "PENDING" ? "warning" : "neutral"}>
                      {l.status}
                    </Badge>
                  </TD>
                </TR>
              ))}
            </tbody>
          </Table>
        )}
      </Card>
    </div>
  );
}

/* ─── Services ─────────────────────────────────────────────────────────────── */
// Editable: assign the worker to services offered at their branch. Read-only
// display is replaced by the interactive branch-scoped picker.
export function ServicesTab({ data }: { data: WorkerWorkspaceData }) {
  return (
    <WorkerServicesManager
      workerId={data.worker.id}
      branch={data.primaryBranch ? { id: data.primaryBranch.id, name: data.primaryBranch.name } : null}
      assigned={data.worker.services.map((ws) => ws.service)}
    />
  );
}

/* ─── Performance ──────────────────────────────────────────────────────────── */
export function PerformanceTab({ data }: { data: WorkerWorkspaceData }) {
  const p = data.performance;
  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
      <StatCard label="Completed bookings" value={p.completedBookings.toLocaleString("en-IN")} icon={CheckCircle2} />
      <StatCard label="Services performed" value={p.completedServices.toLocaleString("en-IN")} icon={Scissors} />
      <StatCard label="Repeat customers" value={String(p.repeatCustomers)} icon={Users} />
      <StatCard label="Overall rating" value={p.totalReviews > 0 ? `${p.averageRating.toFixed(1)} / 5` : "—"} hint={`${p.totalReviews} reviews`} icon={Star} />
      <StatCard label="Completion rate" value={`${p.completionRate}%`} icon={Percent} />
      <StatCard label="Cancellation rate" value={`${p.cancellationRate}%`} icon={Percent} />
      <StatCard label="Revenue generated" value={money(p.revenueGenerated)} hint="from completed work" icon={Wallet} />
      <StatCard label="Portfolio completion" value={`${p.portfolioCompletion}%`} icon={Award} />
    </div>
  );
}

/* ─── Documents (certificates only — schema-limited) ───────────────────────── */
export function DocumentsTab({ data }: { data: WorkerWorkspaceData }) {
  const certs = data.worker.certificates;
  return (
    <ProfileSection title="Certificates" icon={FileText}>
      {certs.length === 0 ? (
        <EmptyInline icon={FileText} label="No documents on file" hint="Only certificates are stored today." />
      ) : (
        <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
          {certs.map((c, i) => (
            <div key={`${c}-${i}`} className="flex items-center gap-2.5 rounded-lg border border-gray-100 bg-gray-50/40 px-3 py-2.5 dark:border-[var(--sa-border)] dark:bg-[var(--sa-tile)]">
              <GraduationCap className="size-4 shrink-0 text-gray-400 dark:text-[var(--sa-muted)]" aria-hidden="true" />
              <p className="min-w-0 truncate text-sm text-gray-700 dark:text-[var(--sa-text-2)]">{c}</p>
            </div>
          ))}
        </div>
      )}
    </ProfileSection>
  );
}

/* ─── Activity (AuditLog — sparse by nature) ───────────────────────────────── */
export function ActivityTab({ data }: { data: WorkerWorkspaceData }) {
  if (data.activity.length === 0) {
    return <EmptyState icon={History} title="No recorded activity" hint="Events are shown as the audit trail captures them." />;
  }
  return (
    <ol className="space-y-2">
      {data.activity.map((e) => (
        <li key={e.id} className="flex items-center gap-3 rounded-lg border border-gray-100 bg-white p-3 dark:border-[var(--sa-border)] dark:bg-[var(--sa-surface)]">
          <span className="flex size-8 shrink-0 items-center justify-center rounded-full bg-gray-50 text-gray-400 ring-1 ring-gray-100 dark:bg-[var(--sa-elevated)] dark:text-[var(--sa-muted)] dark:ring-[var(--sa-border)]">
            <History className="size-3.5" aria-hidden="true" />
          </span>
          <div className="min-w-0 flex-1">
            <p className="text-sm text-gray-800 dark:text-[var(--sa-text)]">
              <span className="font-medium">{e.action.replace(/_/g, " ")}</span>
              <span className="text-gray-400 dark:text-[var(--sa-muted)]"> · {e.module}</span>
            </p>
            <p className="text-[11px] text-gray-400 dark:text-[var(--sa-muted)]">{formatDate(e.createdAt)} · by {e.userType.replace(/_/g, " ").toLowerCase()}</p>
          </div>
        </li>
      ))}
    </ol>
  );
}

/* ─── Shared empties ───────────────────────────────────────────────────────── */
function EmptyState({ icon: Icon, title, hint }: { icon: React.ComponentType<{ className?: string }>; title: string; hint?: string }) {
  return (
    <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-gray-200 bg-white px-6 py-14 text-center dark:border-[var(--sa-border)] dark:bg-[var(--sa-surface)]">
      <span className="flex size-11 items-center justify-center rounded-full bg-gray-50 text-gray-300 ring-1 ring-gray-200 dark:bg-[var(--sa-elevated)] dark:text-[var(--sa-muted)] dark:ring-[var(--sa-border)]"><Icon className="size-5" /></span>
      <p className="mt-3 text-sm font-medium text-gray-700 dark:text-[var(--sa-text-2)]">{title}</p>
      {hint && <p className="mt-1 text-xs text-gray-400 dark:text-[var(--sa-muted)]">{hint}</p>}
    </div>
  );
}

function EmptyInline({ icon: Icon, label, hint }: { icon: React.ComponentType<{ className?: string }>; label: string; hint?: string }) {
  return (
    <div className="flex flex-col items-center justify-center px-6 py-10 text-center">
      <Icon className="size-5 text-gray-300 dark:text-[var(--sa-muted)]" aria-hidden="true" />
      <p className="mt-2 text-sm text-gray-500 dark:text-[var(--sa-text-2)]">{label}</p>
      {hint && <p className="text-xs text-gray-400 dark:text-[var(--sa-muted)]">{hint}</p>}
    </div>
  );
}
