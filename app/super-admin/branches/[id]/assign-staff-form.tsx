"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { API } from "@/lib/endpoints";
import { Eye, EyeOff, Wand2 } from "lucide-react";

const ROLES = [
  { value: "OWNER",        label: "Owner" },
  { value: "BRANCH_ADMIN", label: "Branch Admin" },
  { value: "RECEPTIONIST", label: "Receptionist" },
  { value: "INVENTORY_MANAGER", label: "Inventory Manager" },
  { value: "ACCOUNTANT",   label: "Accountant" },
];

// Role slug for the auto-email, e.g. RECEPTIONIST → "receptionist",
// INVENTORY_MANAGER → "inventory".
function roleSlug(userType: string) {
  return userType.toLowerCase().split("_")[0];
}

// firstname.role@renzo.com — lowercased, stripped of anything but a–z/0–9.
function buildEmail(firstName: string, userType: string) {
  const first = firstName.trim().toLowerCase().replace(/[^a-z0-9]/g, "");
  if (!first) return "";
  return `${first}.${roleSlug(userType)}@renzo.com`;
}

export function AssignStaffForm({ branchId }: { branchId: string }) {
  const router = useRouter();
  const [open, setOpen] = React.useState(false);
  const [loading, setLoading] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [showPassword, setShowPassword] = React.useState(false);
  // Once the admin hand-edits the email we stop auto-overwriting it.
  const [emailTouched, setEmailTouched] = React.useState(false);
  const [form, setForm] = React.useState({
    firstName: "", lastName: "", userType: "OWNER",
    email: "", phone: "", password: "",
  });

  function set(k: keyof typeof form) {
    return (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) =>
      setForm((f) => ({ ...f, [k]: e.target.value }));
  }

  // Name or role changes re-derive the email until the admin overrides it.
  function onFirstName(e: React.ChangeEvent<HTMLInputElement>) {
    const firstName = e.target.value;
    setForm((f) => ({
      ...f,
      firstName,
      email: emailTouched ? f.email : buildEmail(firstName, f.userType),
    }));
  }
  function onRole(e: React.ChangeEvent<HTMLSelectElement>) {
    const userType = e.target.value;
    setForm((f) => ({
      ...f,
      userType,
      email: emailTouched ? f.email : buildEmail(f.firstName, userType),
    }));
  }

  function regenerateEmail() {
    setEmailTouched(false);
    setForm((f) => ({ ...f, email: buildEmail(f.firstName, f.userType) }));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    // Phone is optional (email or phone required), but when given it must be a
    // 10-digit Indian mobile number.
    const phone = form.phone.trim();
    if (phone && !/^\d{10}$/.test(phone)) {
      setError("Phone must be exactly 10 digits.");
      return;
    }
    if (!phone && !form.email.trim()) {
      setError("Email or phone is required.");
      return;
    }

    setLoading(true);
    try {
      const res = await fetch(API.admin.staff, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...form, phone, branchId }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.message ?? "Failed to create staff");
        return;
      }
      setOpen(false);
      setEmailTouched(false);
      setForm({ firstName: "", lastName: "", userType: "OWNER", email: "", phone: "", password: "" });
      router.refresh();
    } catch {
      setError("Network error");
    } finally {
      setLoading(false);
    }
  }

  if (!open) {
    return (
      <button
        onClick={() => setOpen(true)}
        className="rounded border border-gray-300 bg-white px-3 py-1.5 text-xs font-medium text-gray-700 hover:bg-gray-50"
      >
        + Add Staff
      </button>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="rounded border border-gray-200 bg-gray-50 p-4 space-y-3">
      <p className="text-sm font-medium text-gray-800">Assign Staff to Branch</p>

      {error && <p className="text-xs text-red-600">{error}</p>}

      <div className="grid gap-3 sm:grid-cols-2">
        <div>
          <label className="block text-[11px] font-medium text-gray-500 mb-1">First Name *</label>
          <input required value={form.firstName} onChange={onFirstName} className={inputCls} />
        </div>
        <div>
          <label className="block text-[11px] font-medium text-gray-500 mb-1">Last Name *</label>
          <input required value={form.lastName} onChange={set("lastName")} className={inputCls} />
        </div>
        <div>
          <label className="block text-[11px] font-medium text-gray-500 mb-1">Role *</label>
          <select required value={form.userType} onChange={onRole} className={inputCls}>
            {ROLES.map((r) => <option key={r.value} value={r.value}>{r.label}</option>)}
          </select>
        </div>
        <div>
          <label className="block text-[11px] font-medium text-gray-500 mb-1">
            Email
            <button
              type="button"
              onClick={regenerateEmail}
              title="Generate from name + role"
              className="ml-1.5 inline-flex items-center gap-0.5 text-[10px] font-medium text-gray-500 hover:text-gray-800"
            >
              <Wand2 className="size-3" /> auto
            </button>
          </label>
          <input
            type="email"
            value={form.email}
            onChange={(e) => { setEmailTouched(true); set("email")(e); }}
            placeholder="firstname.role@renzo.com"
            className={inputCls}
          />
        </div>
        <div>
          <label className="block text-[11px] font-medium text-gray-500 mb-1">Phone (10 digits)</label>
          <input
            type="tel"
            inputMode="numeric"
            maxLength={10}
            value={form.phone}
            onChange={(e) => setForm((f) => ({ ...f, phone: e.target.value.replace(/\D/g, "").slice(0, 10) }))}
            placeholder="9876543210"
            className={inputCls}
          />
        </div>
        <div>
          <label className="block text-[11px] font-medium text-gray-500 mb-1">Password *</label>
          <div className="relative">
            <input
              required
              type={showPassword ? "text" : "password"}
              minLength={6}
              value={form.password}
              onChange={set("password")}
              className={`${inputCls} pr-9`}
            />
            <button
              type="button"
              onClick={() => setShowPassword((v) => !v)}
              aria-label={showPassword ? "Hide password" : "Show password"}
              className="absolute inset-y-0 right-0 flex items-center px-2.5 text-gray-400 hover:text-gray-700"
            >
              {showPassword ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
            </button>
          </div>
        </div>
      </div>

      <p className="text-[11px] text-gray-400">Email or phone required. Owner/Branch Admin roles require Super Admin access.</p>

      <div className="flex gap-2 pt-1">
        <button type="submit" disabled={loading}
          className="rounded bg-gray-900 px-4 py-1.5 text-xs font-medium text-white hover:bg-gray-700 disabled:opacity-50">
          {loading ? "Creating…" : "Create & Assign"}
        </button>
        <button type="button" onClick={() => { setOpen(false); setError(null); }}
          className="rounded border border-gray-200 px-4 py-1.5 text-xs font-medium text-gray-600 hover:bg-gray-100">
          Cancel
        </button>
      </div>
    </form>
  );
}

const inputCls =
  "w-full rounded border border-gray-200 px-2.5 py-1.5 text-sm text-gray-900 focus:outline-none focus:ring-1 focus:ring-gray-400";
