"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { API } from "@/lib/endpoints";
import { KeyRound, Eye, EyeOff, Loader2, ChevronDown, Check } from "lucide-react";

export type BranchStaff = {
  id: string;
  firstName: string;
  lastName: string;
  email: string | null;
  phone: string | null;
  userType: string;
  isActive: boolean;
};

const ROLES = [
  { value: "OWNER", label: "Owner" },
  { value: "BRANCH_ADMIN", label: "Branch Admin" },
  { value: "RECEPTIONIST", label: "Receptionist" },
  { value: "INVENTORY_MANAGER", label: "Inventory Manager" },
  { value: "MARKETING_MANAGER", label: "Marketing Manager" },
  { value: "ACCOUNTANT", label: "Accountant" },
];
const ROLE_LABEL: Record<string, string> = Object.fromEntries(ROLES.map((r) => [r.value, r.label]));

// Inline staff manager on the branch page: click a member to expand and change
// their role, reset their password, or activate/deactivate them — no separate
// admin screen needed.
export function BranchStaffList({ staff }: { staff: BranchStaff[] }) {
  const router = useRouter();
  const [members, setMembers] = React.useState(staff);
  const [openId, setOpenId] = React.useState<string | null>(null);

  if (members.length === 0) {
    return <p className="px-4 py-4 text-sm text-gray-400">No staff assigned.</p>;
  }

  return (
    <div className="divide-y divide-gray-50">
      {members.map((m) => (
        <div key={m.id}>
          <button
            onClick={() => setOpenId(openId === m.id ? null : m.id)}
            className="flex w-full items-center justify-between px-4 py-2.5 text-left transition hover:bg-gray-50"
          >
            <div>
              <p className="text-sm font-medium text-gray-900">{m.firstName} {m.lastName}</p>
              <p className="text-xs text-gray-400">{ROLE_LABEL[m.userType] ?? m.userType.replace(/_/g, " ")}</p>
            </div>
            <div className="flex items-center gap-2">
              <span className={`rounded-full px-2 py-0.5 text-[11px] font-medium ${m.isActive ? "bg-emerald-50 text-emerald-700" : "bg-gray-100 text-gray-500"}`}>
                {m.isActive ? "Active" : "Off"}
              </span>
              <ChevronDown className={`size-4 text-gray-400 transition ${openId === m.id ? "rotate-180" : ""}`} />
            </div>
          </button>

          {openId === m.id && (
            <StaffEditor
              member={m}
              onChange={(patch) => setMembers((prev) => prev.map((x) => (x.id === m.id ? { ...x, ...patch } : x)))}
              onRefresh={() => router.refresh()}
            />
          )}
        </div>
      ))}
    </div>
  );
}

function StaffEditor({
  member,
  onChange,
  onRefresh,
}: {
  member: BranchStaff;
  onChange: (patch: Partial<BranchStaff>) => void;
  onRefresh: () => void;
}) {
  const [busy, setBusy] = React.useState(false);
  const [msg, setMsg] = React.useState<{ text: string; ok: boolean } | null>(null);
  const [showPwdForm, setShowPwdForm] = React.useState(false);
  const [password, setPassword] = React.useState("");
  const [showPwd, setShowPwd] = React.useState(false);

  function flash(text: string, ok: boolean) {
    setMsg({ text, ok });
    setTimeout(() => setMsg(null), 2500);
  }

  async function patch(body: Record<string, unknown>, okMsg: string, apply: Partial<BranchStaff>) {
    setBusy(true);
    try {
      const res = await fetch(API.admin.staffMember(member.id), {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const json = await res.json().catch(() => null);
      if (!res.ok || json?.success === false) throw new Error(json?.message ?? "Update failed");
      onChange(apply);
      flash(okMsg, true);
      onRefresh();
    } catch (e) {
      flash(e instanceof Error ? e.message : "Update failed", false);
    } finally {
      setBusy(false);
    }
  }

  async function resetPassword() {
    if (password.length < 6) { flash("Min 6 characters", false); return; }
    setBusy(true);
    try {
      const res = await fetch(API.admin.staffResetPwd(member.id), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password }),
      });
      const json = await res.json().catch(() => null);
      if (!res.ok || json?.success === false) throw new Error(json?.message ?? "Reset failed");
      setPassword("");
      setShowPwdForm(false);
      flash("Password reset — signed out everywhere", true);
    } catch (e) {
      flash(e instanceof Error ? e.message : "Reset failed", false);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-3 bg-gray-50/70 px-4 py-3">
      <div className="grid gap-3 sm:grid-cols-2">
        <label className="block">
          <span className="mb-1 block text-[11px] font-medium text-gray-500">Role</span>
          <select
            value={member.userType}
            disabled={busy}
            onChange={(e) => patch({ userType: e.target.value }, `Role → ${ROLE_LABEL[e.target.value]}`, { userType: e.target.value })}
            className="w-full rounded border border-gray-200 px-2.5 py-1.5 text-sm outline-none focus:border-gray-400"
          >
            {!ROLE_LABEL[member.userType] && <option value={member.userType}>{member.userType}</option>}
            {ROLES.map((r) => <option key={r.value} value={r.value}>{r.label}</option>)}
          </select>
        </label>
        <div>
          <span className="mb-1 block text-[11px] font-medium text-gray-500">Contact</span>
          <p className="truncate rounded border border-transparent px-0 py-1.5 text-sm text-gray-600">
            {member.email ?? "—"}{member.phone ? ` · ${member.phone}` : ""}
          </p>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <button
          onClick={() => patch({ isActive: !member.isActive }, member.isActive ? "Deactivated" : "Activated", { isActive: !member.isActive })}
          disabled={busy}
          className="rounded border border-gray-200 bg-white px-3 py-1.5 text-xs font-medium text-gray-700 hover:bg-gray-100 disabled:opacity-50"
        >
          {member.isActive ? "Deactivate" : "Activate"}
        </button>
        <button
          onClick={() => setShowPwdForm((v) => !v)}
          disabled={busy}
          className="inline-flex items-center gap-1 rounded border border-gray-200 bg-white px-3 py-1.5 text-xs font-medium text-gray-700 hover:bg-gray-100 disabled:opacity-50"
        >
          <KeyRound className="size-3.5" /> Reset password
        </button>
        {busy && <Loader2 className="size-4 animate-spin text-gray-400" />}
        {msg && <span className={`text-[11px] ${msg.ok ? "text-emerald-600" : "text-red-500"}`}>{msg.text}</span>}
      </div>

      {showPwdForm && (
        <div className="flex flex-wrap items-center gap-2">
          <div className="relative">
            <input
              autoFocus
              type={showPwd ? "text" : "password"}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="New password (min 6)"
              className="w-56 rounded border border-gray-200 px-2.5 py-1.5 pr-8 text-sm outline-none focus:border-gray-400"
            />
            <button type="button" onClick={() => setShowPwd((s) => !s)} className="absolute inset-y-0 right-0 flex items-center px-2 text-gray-400 hover:text-gray-700">
              {showPwd ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
            </button>
          </div>
          <button
            onClick={resetPassword}
            disabled={busy}
            className="inline-flex items-center gap-1 rounded bg-gray-900 px-3 py-1.5 text-xs font-medium text-white hover:bg-gray-700 disabled:opacity-50"
          >
            <Check className="size-3.5" /> Set
          </button>
        </div>
      )}
    </div>
  );
}
