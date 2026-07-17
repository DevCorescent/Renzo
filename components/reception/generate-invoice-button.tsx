"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { FileText, Loader2 } from "lucide-react";
import { API } from "@/lib/endpoints";

export function GenerateInvoiceButton({ appointmentId }: { appointmentId: string }) {
  const router = useRouter();
  const [busy, setBusy] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  async function generate() {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(API.reception.billing, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ appointmentId }),
      });
      const j = await res.json().catch(() => null);
      if (!res.ok) {
        throw new Error(j?.message ?? "Could not generate invoice");
      }
      const invoiceId = j?.data?.id as string | undefined;
      if (invoiceId) {
        router.push(`/reception/billing/${invoiceId}`);
        return;
      }
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not generate invoice");
      setBusy(false);
    }
  }

  return (
    <span className="inline-flex flex-col items-end gap-0.5">
      <button
        type="button"
        onClick={generate}
        disabled={busy}
        className="inline-flex items-center gap-1 rounded-md border border-gray-200 bg-white px-2 py-0.5 text-xs font-medium text-gray-700 transition hover:border-gray-300 hover:bg-gray-50 disabled:opacity-60"
      >
        {busy ? <Loader2 className="size-3 animate-spin" /> : <FileText className="size-3" aria-hidden="true" />}
        Generate invoice
      </button>
      {error && <span className="text-[11px] text-red-500">{error}</span>}
    </span>
  );
}
