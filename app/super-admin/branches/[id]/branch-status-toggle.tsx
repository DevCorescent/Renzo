"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { API } from "@/lib/endpoints";
import { Power, PowerOff, Loader2, Check, X, AlertTriangle } from "lucide-react";

// Activate / deactivate a branch. Deactivating flips isActive + isPublic off so
// it drops out of the public site and booking flow (history is preserved);
// activating restores both. Deactivation confirms via a corner toast rather than
// an inline box, so it never pushes the page layout around.
export function BranchStatusToggle({
  branchId,
  branchName,
  isActive,
}: {
  branchId: string;
  branchName: string;
  isActive: boolean;
}) {
  const router = useRouter();
  const [confirming, setConfirming] = React.useState(false);
  const [loading, setLoading] = React.useState(false);
  const [result, setResult] = React.useState<{ text: string; ok: boolean } | null>(null);

  // Auto-dismiss the result toast.
  React.useEffect(() => {
    if (!result) return;
    const t = setTimeout(() => setResult(null), 3000);
    return () => clearTimeout(t);
  }, [result]);

  async function setActive(next: boolean) {
    setLoading(true);
    try {
      const res = await fetch(API.admin.branch(branchId), {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ isActive: next, isPublic: next }),
      });
      const json = await res.json().catch(() => null);
      if (!res.ok || json?.success === false) {
        throw new Error(json?.message ?? "Failed to update branch");
      }
      setConfirming(false);
      setResult({ text: next ? "Branch activated" : "Branch deactivated", ok: true });
      router.refresh();
    } catch (e) {
      setResult({ text: e instanceof Error ? e.message : "Failed to update branch", ok: false });
    } finally {
      setLoading(false);
    }
  }

  return (
    <>
      {isActive ? (
        <button
          onClick={() => setConfirming(true)}
          className="inline-flex items-center gap-1.5 rounded border border-red-200 bg-white px-3 py-1.5 text-xs font-medium text-red-600 transition hover:bg-red-50"
        >
          <PowerOff className="size-3.5" /> Deactivate branch
        </button>
      ) : (
        <button
          onClick={() => setActive(true)}
          disabled={loading}
          className="inline-flex items-center gap-1.5 rounded border border-emerald-200 bg-emerald-50 px-3 py-1.5 text-xs font-medium text-emerald-700 transition hover:bg-emerald-100 disabled:opacity-50"
        >
          {loading ? <Loader2 className="size-3.5 animate-spin" /> : <Power className="size-3.5" />}
          Activate branch
        </button>
      )}

      {/* ── Confirm toast (bottom-right) ─────────────────────────────────── */}
      {confirming && (
        <ToastShell tone="warning">
          <div className="flex items-start gap-2.5">
            <AlertTriangle className="mt-0.5 size-4 shrink-0 text-amber-500" />
            <div className="flex-1">
              <p className="text-sm font-medium text-gray-900">Deactivate {branchName}?</p>
              <p className="mt-0.5 text-xs text-gray-500">
                It will be hidden from the public site and booking flow. History is preserved — you
                can reactivate anytime.
              </p>
              <div className="mt-3 flex justify-end gap-2">
                <button
                  onClick={() => setConfirming(false)}
                  disabled={loading}
                  className="rounded border border-gray-200 px-3 py-1.5 text-xs font-medium text-gray-600 hover:bg-gray-100 disabled:opacity-50"
                >
                  Cancel
                </button>
                <button
                  onClick={() => setActive(false)}
                  disabled={loading}
                  className="inline-flex items-center gap-1.5 rounded bg-red-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-red-700 disabled:opacity-50"
                >
                  {loading && <Loader2 className="size-3.5 animate-spin" />}
                  Yes, deactivate
                </button>
              </div>
            </div>
          </div>
        </ToastShell>
      )}

      {/* ── Result toast ─────────────────────────────────────────────────── */}
      {result && (
        <ToastShell tone={result.ok ? "success" : "error"}>
          <div className="flex items-center gap-2.5">
            {result.ok ? (
              <Check className="size-4 shrink-0 text-emerald-600" />
            ) : (
              <X className="size-4 shrink-0 text-red-600" />
            )}
            <p className="text-sm font-medium text-gray-800">{result.text}</p>
          </div>
        </ToastShell>
      )}
    </>
  );
}

// Fixed bottom-right toast surface. Rendered inline (no portal) — position:fixed
// already lifts it out of the header's flow so it never shifts the layout.
function ToastShell({
  tone,
  children,
}: {
  tone: "warning" | "success" | "error";
  children: React.ReactNode;
}) {
  const border =
    tone === "success" ? "border-emerald-200" : tone === "error" ? "border-red-200" : "border-amber-200";
  return (
    <div
      role="status"
      aria-live="polite"
      className={`fixed bottom-6 right-6 z-[100] w-80 max-w-[calc(100vw-3rem)] rounded-xl border ${border} bg-white p-4 text-left shadow-lg`}
    >
      {children}
    </div>
  );
}
