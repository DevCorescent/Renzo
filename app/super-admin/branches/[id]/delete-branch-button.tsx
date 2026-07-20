"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { API } from "@/lib/endpoints";
import { Trash2, Loader2 } from "lucide-react";

// Soft-deletes (deactivates) a branch. The API keeps the row for referential
// integrity — appointments/invoices stay intact — but flips isActive/isPublic
// off so it disappears from the public site and booking flow.
export function DeleteBranchButton({
  branchId,
  branchName,
}: {
  branchId: string;
  branchName: string;
}) {
  const router = useRouter();
  const [confirming, setConfirming] = React.useState(false);
  const [loading, setLoading] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  async function handleDelete() {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(API.admin.branch(branchId), { method: "DELETE" });
      const json = await res.json().catch(() => null);
      if (!res.ok || json?.success === false) {
        throw new Error(json?.message ?? "Failed to delete branch");
      }
      router.push("/super-admin/branches");
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to delete branch");
      setLoading(false);
    }
  }

  if (!confirming) {
    return (
      <button
        onClick={() => setConfirming(true)}
        className="inline-flex items-center gap-1.5 rounded border border-red-200 bg-white px-3 py-1.5 text-xs font-medium text-red-600 transition hover:bg-red-50"
      >
        <Trash2 className="size-3.5" /> Delete branch
      </button>
    );
  }

  return (
    <div className="rounded border border-red-200 bg-red-50 p-3 text-right">
      <p className="mb-2 text-xs text-red-700">
        Deactivate <span className="font-semibold">{branchName}</span>? It will be
        removed from the public site. History is preserved.
      </p>
      {error && <p className="mb-2 text-xs text-red-600">{error}</p>}
      <div className="flex justify-end gap-2">
        <button
          onClick={() => {
            setConfirming(false);
            setError(null);
          }}
          disabled={loading}
          className="rounded border border-gray-300 bg-white px-3 py-1.5 text-xs font-medium text-gray-600 hover:bg-gray-100 disabled:opacity-50"
        >
          Cancel
        </button>
        <button
          onClick={handleDelete}
          disabled={loading}
          className="inline-flex items-center gap-1.5 rounded bg-red-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-red-700 disabled:opacity-50"
        >
          {loading && <Loader2 className="size-3.5 animate-spin" />}
          {loading ? "Deleting…" : "Yes, delete"}
        </button>
      </div>
    </div>
  );
}
