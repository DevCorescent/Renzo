"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { API } from "@/lib/endpoints";
import { BRANCH_ADMIN_MODULES } from "@/components/shared/app-shell";

// OWNER: Aman | MODULE: Super Admin — Branch Admin module permissions
// Toggles which sidebar modules a Branch Admin can reach. Saves through the
// existing PATCH /api/v1/admin/staff/[id].

export function StaffPermissions({
  staffId,
  staffName,
  current,
}: {
  staffId: string;
  staffName: string;
  current: string[];
}) {
  const router = useRouter();
  const [open, setOpen] = React.useState(false);
  const [selected, setSelected] = React.useState<string[]>(
    // Empty = never configured = full access today, so show everything ticked.
    current.length > 0 ? current : BRANCH_ADMIN_MODULES.map((m) => m.key)
  );
  const [loading, setLoading] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  function toggle(key: string) {
    setSelected((prev) =>
      prev.includes(key) ? prev.filter((k) => k !== key) : [...prev, key]
    );
  }

  async function handleSave() {
    if (selected.length === 0) {
      setError("Grant at least one module");
      return;
    }
    setError(null);
    setLoading(true);
    try {
      const res = await fetch(API.admin.staffMember(staffId), {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ permissions: selected }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.message ?? "Failed to save permissions");
        return;
      }
      setOpen(false);
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
        className="mt-2 rounded border border-gray-300 bg-white px-2.5 py-1 text-[11px] font-medium text-gray-700 hover:bg-gray-50"
      >
        Permissions
        <span className="ml-1 text-gray-400">
          {current.length > 0 ? current.length : BRANCH_ADMIN_MODULES.length}/
          {BRANCH_ADMIN_MODULES.length}
        </span>
      </button>
    );
  }

  return (
    <div className="mt-2 w-full rounded border border-gray-200 bg-gray-50 p-3 space-y-3">
      <p className="text-xs font-medium text-gray-800">
        Modules for {staffName}
      </p>

      {error && <p className="text-xs text-red-600">{error}</p>}

      <div className="grid gap-1.5 sm:grid-cols-2">
        {BRANCH_ADMIN_MODULES.map((m) => (
          <label
            key={m.key}
            className="flex cursor-pointer items-center gap-2 rounded px-1.5 py-1 text-xs text-gray-700 hover:bg-white"
          >
            <input
              type="checkbox"
              checked={selected.includes(m.key)}
              onChange={() => toggle(m.key)}
              className="size-3.5 accent-gray-900"
            />
            {m.label}
          </label>
        ))}
      </div>

      <p className="text-[11px] text-gray-400">
        Unticked modules are hidden from the sidebar and blocked if opened directly.
      </p>

      <div className="flex gap-2">
        <button
          type="button"
          onClick={handleSave}
          disabled={loading}
          className="rounded bg-gray-900 px-3 py-1.5 text-xs font-medium text-white hover:bg-gray-700 disabled:opacity-50"
        >
          {loading ? "Saving…" : "Save"}
        </button>
        <button
          type="button"
          onClick={() => {
            setOpen(false);
            setError(null);
          }}
          className="rounded border border-gray-200 px-3 py-1.5 text-xs font-medium text-gray-600 hover:bg-gray-100"
        >
          Cancel
        </button>
      </div>
    </div>
  );
}
