// ============================================================================
// OWNER  : Hemant | MODULE: Worker — Profile
//
// The read-only record sections: personal, employment, skills, assigned services,
// branch assignments and documents. Every value comes from existing WorkerProfile
// data — nothing invented. There is no worker self-edit API, so these are display
// only; a section with no data hides itself (skills, services, documents) rather
// than showing an empty shell.
// ============================================================================

import * as React from "react";
import { Badge } from "@/components/shared/ui";
import { User, Briefcase, Award, Scissors, Building2, FileText } from "lucide-react";
import { ProfileSection, Field, FieldGrid, formatDate } from "./profile-ui";

// Proficiency (1–5) → a human level. Local to the profile so it stays independent
// of the portfolio module (the two are kept deliberately separate).
const LEVELS = ["New", "Skilled", "Proficient", "Advanced", "Expert", "Master"];
function proficiencyLevel(p: number): string {
  return LEVELS[Math.max(0, Math.min(5, p))];
}

/* ─── Personal ───────────────────────────────────────────────────────────── */
export type PersonalData = {
  phone: string | null;
  email: string | null;
  gender: string;
  dateOfBirth: string | Date | null;
  languages: string[];
  bio: string | null;
};

export function PersonalDetails({ data }: { data: PersonalData }) {
  return (
    <ProfileSection title="Personal details" icon={User}>
      <FieldGrid>
        <Field label="Phone" value={data.phone} />
        <Field label="Email" value={data.email} />
        <Field label="Gender" value={data.gender} />
        <Field label="Date of birth" value={data.dateOfBirth ? formatDate(data.dateOfBirth) : null} />
        <Field label="Languages" value={data.languages.length ? data.languages.join(", ") : null} />
      </FieldGrid>
      {data.bio?.trim() && (
        <div className="mt-3 rounded-lg border border-gray-100 bg-gray-50/40 p-3">
          <dt className="text-[11px] font-medium uppercase tracking-wide text-gray-400">Bio</dt>
          <dd className="mt-1 text-sm leading-relaxed text-gray-700">{data.bio}</dd>
        </div>
      )}
    </ProfileSection>
  );
}

/* ─── Employment ─────────────────────────────────────────────────────────── */
export type EmploymentData = {
  employeeCode: string;
  department: string | null;
  designation: string | null;
  experience: number;
  joinDate: string | Date;
  currentBranch: string | null;
  primaryBranch: string | null;
  isActive: boolean;
};

export function EmploymentDetails({ data }: { data: EmploymentData }) {
  return (
    <ProfileSection title="Employment details" icon={Briefcase}>
      <FieldGrid>
        <Field label="Employee code" value={<span className="font-mono">{data.employeeCode}</span>} />
        <Field label="Department" value={data.department} />
        <Field label="Designation" value={data.designation} />
        <Field label="Experience" value={`${data.experience} ${data.experience === 1 ? "year" : "years"}`} />
        <Field label="Joining date" value={formatDate(data.joinDate)} />
        <Field label="Current branch" value={data.currentBranch} />
        <Field label="Primary branch" value={data.primaryBranch} />
        <Field
          label="Employment status"
          value={
            <Badge tone={data.isActive ? "success" : "danger"}>
              {data.isActive ? "Active" : "Inactive"}
            </Badge>
          }
        />
      </FieldGrid>
    </ProfileSection>
  );
}

/* ─── Skills ─────────────────────────────────────────────────────────────── */
export function ProfessionalSkills({ skills }: { skills: { name: string; proficiency: number }[] }) {
  if (skills.length === 0) return null;

  return (
    <ProfileSection title="Professional skills" icon={Award}>
      <div className="grid gap-3 sm:grid-cols-2">
        {skills.map((s) => (
          <div key={s.name} className="rounded-lg border border-gray-100 p-3">
            <div className="flex items-center justify-between">
              <p className="text-sm font-medium text-gray-800">{s.name}</p>
              <Badge tone="neutral">{proficiencyLevel(s.proficiency)}</Badge>
            </div>
            <div className="mt-2 flex items-center gap-1" aria-label={`Proficiency ${s.proficiency} of 5`}>
              {[1, 2, 3, 4, 5].map((i) => (
                <span
                  key={i}
                  className={`h-1.5 flex-1 rounded-full ${i <= s.proficiency ? "bg-gray-800" : "bg-gray-100"}`}
                />
              ))}
            </div>
          </div>
        ))}
      </div>
    </ProfileSection>
  );
}

/* ─── Assigned services ──────────────────────────────────────────────────── */
export function AssignedServices({
  services,
}: {
  services: { name: string; duration: number; isActive: boolean }[];
}) {
  if (services.length === 0) return null;

  return (
    <ProfileSection title="Assigned services" icon={Scissors} bodyClassName="p-0">
      <div className="divide-y divide-gray-50">
        {services.map((s) => (
          <div key={s.name} className="flex items-center justify-between px-4 py-3">
            <div>
              <p className="text-sm font-medium text-gray-800">{s.name}</p>
              <p className="text-xs text-gray-400">{s.duration} min</p>
            </div>
            <Badge tone={s.isActive ? "success" : "neutral"}>{s.isActive ? "Active" : "Off"}</Badge>
          </div>
        ))}
      </div>
    </ProfileSection>
  );
}

/* ─── Current branch / assignments ───────────────────────────────────────── */
export function CurrentBranch({
  branches,
}: {
  branches: { name: string; city: string; isPrimary: boolean; isActive: boolean }[];
}) {
  if (branches.length === 0) return null;

  return (
    <ProfileSection title="Branch assignment" icon={Building2} bodyClassName="p-0">
      <div className="divide-y divide-gray-50">
        {branches.map((b, i) => (
          <div key={`${b.name}-${i}`} className="flex items-center justify-between px-4 py-3">
            <div>
              <p className="text-sm font-medium text-gray-900">{b.name}</p>
              <p className="text-xs text-gray-400">{b.city}</p>
            </div>
            <div className="flex gap-2">
              {b.isPrimary && <Badge tone="primary">Primary</Badge>}
              <Badge tone={b.isActive ? "success" : "neutral"}>{b.isActive ? "Active" : "Off"}</Badge>
            </div>
          </div>
        ))}
      </div>
    </ProfileSection>
  );
}

/* ─── Documents ──────────────────────────────────────────────────────────────
 * The only document-like field on WorkerProfile is `certificates` (a String[]).
 * There is no WorkerDocument model, so identity / professional documents are not
 * shown — the section renders certificates when present and hides entirely when
 * there are none. Read only.
 */
export function Documents({ certificates }: { certificates: string[] }) {
  if (certificates.length === 0) return null;

  return (
    <ProfileSection title="Documents" icon={FileText}>
      <div className="grid gap-2 sm:grid-cols-2">
        {certificates.map((c, i) => (
          <div
            key={`${c}-${i}`}
            className="flex items-center gap-2.5 rounded-lg border border-gray-100 bg-gray-50/40 px-3 py-2.5"
          >
            <FileText className="size-4 shrink-0 text-gray-400" aria-hidden="true" />
            <p className="min-w-0 truncate text-sm text-gray-700">{c}</p>
          </div>
        ))}
      </div>
    </ProfileSection>
  );
}
