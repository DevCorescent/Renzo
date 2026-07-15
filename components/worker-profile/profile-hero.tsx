// ============================================================================
// OWNER  : Hemant | MODULE: Worker — Profile
//
// The identity header of the INTERNAL profile — deliberately light and corporate,
// not the dark portfolio hero, so the two modules never look like the same page.
// Reuses WorkerAvatar (photo with initials fallback) and the shared Badge. Every
// value is guarded, so a worker with no designation or branch still renders
// cleanly. Server component; presentational.
// ============================================================================

import * as React from "react";
import { Badge } from "@/components/shared/ui";
import { WorkerAvatar } from "@/components/workers/worker-ui";
import { Hash, Building2, Briefcase, CalendarDays } from "lucide-react";
import { formatDate } from "./profile-ui";

export type ProfileHeroData = {
  id: string;
  firstName: string;
  lastName: string;
  photo: string | null;
  designation: string | null;
  department: string | null;
  employeeCode: string;
  branchName: string | null;
  experience: number;
  isActive: boolean;
  joinDate: string | Date;
};

function MetaItem({
  icon: Icon,
  children,
}: {
  icon: React.ComponentType<{ className?: string }>;
  children: React.ReactNode;
}) {
  return (
    <span className="inline-flex items-center gap-1.5 text-xs text-gray-500">
      <Icon className="size-3.5 text-gray-400" aria-hidden="true" />
      {children}
    </span>
  );
}

export function ProfileHero({ data }: { data: ProfileHeroData }) {
  const fullName = `${data.firstName} ${data.lastName}`.trim();
  const role = [data.designation, data.department].filter(Boolean).join(" · ");

  return (
    <header className="rounded-2xl border border-gray-200 bg-white p-6 shadow-sm">
      <div className="flex flex-col items-center gap-5 sm:flex-row sm:items-start">
        <WorkerAvatar
          firstName={data.firstName}
          lastName={data.lastName}
          photo={data.photo}
          id={data.id}
          size={88}
        />

        <div className="min-w-0 flex-1 text-center sm:text-left">
          <div className="flex flex-col items-center gap-2 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h1 className="text-xl font-semibold tracking-tight text-gray-900">{fullName}</h1>
              {role && <p className="mt-0.5 text-sm text-gray-500">{role}</p>}
            </div>
            <Badge tone={data.isActive ? "success" : "danger"}>
              {data.isActive ? "Active" : "Inactive"}
            </Badge>
          </div>

          <div className="mt-4 flex flex-wrap items-center justify-center gap-x-5 gap-y-2 sm:justify-start">
            <MetaItem icon={Hash}>
              <span className="font-mono">{data.employeeCode}</span>
            </MetaItem>
            {data.branchName && <MetaItem icon={Building2}>{data.branchName}</MetaItem>}
            {data.experience > 0 && (
              <MetaItem icon={Briefcase}>
                {data.experience} {data.experience === 1 ? "year" : "years"}
              </MetaItem>
            )}
            <MetaItem icon={CalendarDays}>Joined {formatDate(data.joinDate)}</MetaItem>
          </div>
        </div>
      </div>
    </header>
  );
}
