// ============================================================================
// OWNER  : Gauransh
// MODULE : Worker Workspace — header
//
// The identity band that sits above the tabs: who this worker is and the few
// numbers an admin scans first (status, experience, rating, portfolio completion).
// Presentational only — every value is passed in from the single workspace fetch,
// so the header never triggers a query of its own.
// ============================================================================

import * as React from "react";
import { Badge } from "@/components/shared/ui";
import { WorkerAvatar } from "@/components/workers/worker-ui";
import { WorkerPhotoEditor } from "@/components/worker-workspace/worker-photo-editor";
import { Hash, Building2, Briefcase, Star } from "lucide-react";
import type { WorkerWorkspaceData } from "@/lib/worker-workspace";

function metaName(w: WorkerWorkspaceData["worker"]): string {
  return w.displayName?.trim() || `${w.firstName} ${w.lastName}`.trim();
}

export function WorkspaceHeader({ data }: { data: WorkerWorkspaceData }) {
  const { worker, primaryBranch, header } = data;
  const role = [worker.designation?.name, worker.department?.name].filter(Boolean).join(" · ");

  return (
    <header className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm sm:p-6">
      <div className="flex flex-col gap-5 sm:flex-row sm:items-center">
        <div className="flex items-center gap-4">
          <WorkerAvatar
            firstName={worker.firstName}
            lastName={worker.lastName}
            photo={worker.profilePhoto}
            id={worker.id}
            size={64}
          />
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <h1 className="truncate text-lg font-semibold tracking-tight text-gray-900">{metaName(worker)}</h1>
              <Badge tone={worker.isActive ? "success" : "danger"}>{worker.isActive ? "Active" : "Inactive"}</Badge>
            </div>
            {role && <p className="mt-0.5 truncate text-sm text-gray-500">{role}</p>}
            <div className="mt-1.5 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-gray-400">
              <span className="inline-flex items-center gap-1"><Hash className="size-3" aria-hidden="true" /><span className="font-mono">{worker.employeeCode}</span></span>
              {primaryBranch && <span className="inline-flex items-center gap-1"><Building2 className="size-3" aria-hidden="true" />{primaryBranch.name}</span>}
              {worker.experience > 0 && (
                <span className="inline-flex items-center gap-1"><Briefcase className="size-3" aria-hidden="true" />{worker.experience} {worker.experience === 1 ? "yr" : "yrs"}</span>
              )}
            </div>
            <WorkerPhotoEditor workerId={worker.id} currentPhoto={worker.profilePhoto} />
          </div>
        </div>

        {/* Headline metrics */}
        <div className="grid flex-1 grid-cols-2 gap-3 sm:max-w-xs sm:grid-cols-2">
          <Metric label="Rating" value={header.totalReviews > 0 ? header.averageRating.toFixed(1) : "—"} hint={`${header.totalReviews} reviews`} icon={Star} />
          <Metric label="Portfolio" value={`${header.portfolioCompletion}%`} hint="complete" />
        </div>
      </div>
    </header>
  );
}

function Metric({
  label, value, hint, icon: Icon,
}: {
  label: string;
  value: string;
  hint?: string;
  icon?: React.ComponentType<{ className?: string }>;
}) {
  return (
    <div className="rounded-xl border border-gray-100 bg-gray-50/60 p-3">
      <p className="flex items-center gap-1 text-[11px] font-medium text-gray-500">
        {Icon && <Icon className="size-3 text-gray-400" aria-hidden="true" />}
        {label}
      </p>
      <p className="mt-1 text-lg font-semibold text-gray-900">{value}</p>
      {hint && <p className="text-[11px] text-gray-400">{hint}</p>}
    </div>
  );
}
