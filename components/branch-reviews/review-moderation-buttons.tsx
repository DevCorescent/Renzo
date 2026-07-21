"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { API } from "@/lib/endpoints";

export function ReviewModerationButtons({ reviewId, status }: { reviewId: string; status: string }) {
  const router = useRouter();
  const [busy, setBusy] = React.useState<"approve" | "reject" | null>(null);
  const [error, setError] = React.useState<string | null>(null);

  if (status !== "PENDING" && status !== "FLAGGED") return null;

  async function act(kind: "approve" | "reject") {
    setBusy(kind);
    setError(null);
    try {
      const path =
        kind === "approve"
          ? API.admin.reviewApprove(reviewId)
          : API.admin.reviewReject(reviewId);
      const res = await fetch(path, { method: "POST" });
      const json = await res.json();
      if (!res.ok || !json.success) {
        setError(json.message ?? "Failed");
        return;
      }
      router.refresh();
    } catch {
      setError("Network error");
    } finally {
      setBusy(null);
    }
  }

  return (
    <div className="flex flex-col items-end gap-1">
      <div className="flex gap-2">
        <button
          type="button"
          disabled={busy !== null}
          onClick={() => act("reject")}
          className="text-xs font-medium text-red-600 hover:underline disabled:opacity-50"
        >
          {busy === "reject" ? "…" : "Reject"}
        </button>
        <button
          type="button"
          disabled={busy !== null}
          onClick={() => act("approve")}
          className="text-xs font-medium text-gray-900 hover:underline disabled:opacity-50 dark:text-[var(--sa-text)]"
        >
          {busy === "approve" ? "…" : "Approve"}
        </button>
      </div>
      {error && <p className="text-[10px] text-red-600">{error}</p>}
    </div>
  );
}
