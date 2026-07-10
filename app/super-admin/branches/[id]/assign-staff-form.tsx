"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { API } from "@/lib/endpoints";

const ROLES = [
  { value: "OWNER",        label: "Owner" },
  { value: "BRANCH_ADMIN", label: "Branch Admin" },
  { value: "RECEPTIONIST", label: "Receptionist" },
  { value: "INVENTORY_MANAGER", label: "Inventory Manager" },
  { value: "ACCOUNTANT",   label: "Accountant" },
];

export function AssignStaffForm({ branchId }: { branchId: string }) {
  const router = useRouter();
  const [open, setOpen] = React.useState(false);
  const [loading, setLoading] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [form, setForm] = React.useState({
    firstName: "", lastName: "", userType: "OWNER",
    email: "", phone: "", password: "",
  });

  function set(k: keyof typeof form) {
    return (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) =>
      setForm((f) => ({ ...f, [k]: e.target.value }));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const res = await fetch(API.admin.staff, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...form, branchId }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.message ?? "Failed to create staff");
        return;
      }
      setOpen(false);
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
          <input required value={form.firstName} onChange={set("firstName")}
            className="w-full rounded border border-gray-200 px-2.5 py-1.5 text-sm text-gray-900 focus:outline-none focus:ring-1 focus:ring-gray-400" />
        </div>
        <div>
          <label className="block text-[11px] font-medium text-gray-500 mb-1">Last Name *</label>
          <input required value={form.lastName} onChange={set("lastName")}
            className="w-full rounded border border-gray-200 px-2.5 py-1.5 text-sm text-gray-900 focus:outline-none focus:ring-1 focus:ring-gray-400" />
        </div>
        <div>
          <label className="block text-[11px] font-medium text-gray-500 mb-1">Role *</label>
          <select required value={form.userType} onChange={set("userType")}
            className="w-full rounded border border-gray-200 px-2.5 py-1.5 text-sm text-gray-900 focus:outline-none focus:ring-1 focus:ring-gray-400">
            {ROLES.map((r) => <option key={r.value} value={r.value}>{r.label}</option>)}
          </select>
        </div>
        <div>
          <label className="block text-[11px] font-medium text-gray-500 mb-1">Email</label>
          <input type="email" value={form.email} onChange={set("email")}
            className="w-full rounded border border-gray-200 px-2.5 py-1.5 text-sm text-gray-900 focus:outline-none focus:ring-1 focus:ring-gray-400" />
        </div>
        <div>
          <label className="block text-[11px] font-medium text-gray-500 mb-1">Phone</label>
          <input type="tel" value={form.phone} onChange={set("phone")}
            className="w-full rounded border border-gray-200 px-2.5 py-1.5 text-sm text-gray-900 focus:outline-none focus:ring-1 focus:ring-gray-400" />
        </div>
        <div>
          <label className="block text-[11px] font-medium text-gray-500 mb-1">Password *</label>
          <input required type="password" minLength={6} value={form.password} onChange={set("password")}
            className="w-full rounded border border-gray-200 px-2.5 py-1.5 text-sm text-gray-900 focus:outline-none focus:ring-1 focus:ring-gray-400" />
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
