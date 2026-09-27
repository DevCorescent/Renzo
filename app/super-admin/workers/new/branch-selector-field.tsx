"use client";

// Branch selector rendered inside the WorkerForm's extraFields slot.
// Must be a client component so it can read its own state and show a hint.

import * as React from "react";

type Branch = { id: string; name: string; city: string };

export function BranchSelectorField({ branches }: { branches: Branch[] }) {
  const [selected, setSelected] = React.useState("");

  return (
    <div className="space-y-1">
      <label htmlFor="branchId" className="block text-sm font-medium text-gray-700 dark:text-gray-300">
        Assign to branch <span className="text-red-500">*</span>
      </label>
      <select
        id="branchId"
        name="branchId"
        required
        value={selected}
        onChange={(e) => setSelected(e.target.value)}
        className="h-9 w-full rounded border border-gray-200 bg-white px-2.5 text-sm text-gray-900 outline-none transition focus:border-gray-400 focus:ring-2 focus:ring-gray-900/5 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-100"
      >
        <option value="">Select a branch…</option>
        {branches.map((b) => (
          <option key={b.id} value={b.id}>
            {b.name}{b.city ? ` — ${b.city}` : ""}
          </option>
        ))}
      </select>
      {branches.length === 0 && (
        <p className="text-xs text-amber-600">No active branches found. Create a branch first.</p>
      )}
    </div>
  );
}
