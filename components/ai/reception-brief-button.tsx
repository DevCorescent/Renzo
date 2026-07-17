"use client";

import * as React from "react";
import { API } from "@/lib/endpoints";
import { SuggestButton } from "@/components/ai/suggest-button";

export function ReceptionBriefButton() {
  const [open, setOpen] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [data, setData] = React.useState<{
    headline: string;
    brief: string;
    priorities: string[];
    risks: string[];
    appointmentCount: number;
    branchName: string;
  } | null>(null);

  async function run() {
    setError(null);
    const res = await fetch(API.ai.receptionBrief, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify({}),
    });
    const json = await res.json();
    if (!res.ok || !json.success) {
      setError(json.message ?? "Failed to generate brief");
      setOpen(true);
      return;
    }
    setData(json.data);
    setOpen(true);
  }

  return (
    <div className="space-y-3">
      <SuggestButton
        label="AI day brief"
        className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-medium text-slate-800 shadow-sm hover:bg-slate-50 disabled:opacity-50"
        onSuggest={run}
      />
      {open && (
        <div className="rounded-xl border border-slate-200 bg-white p-4 text-sm shadow-sm">
          {error ? (
            <p className="text-red-600">{error}</p>
          ) : data ? (
            <div className="space-y-2">
              <div className="flex items-start justify-between gap-2">
                <div>
                  <p className="font-semibold text-slate-900">{data.headline}</p>
                  <p className="text-xs text-slate-500">
                    {data.branchName} · {data.appointmentCount} appointments
                  </p>
                </div>
                <button
                  type="button"
                  className="text-xs text-slate-500 hover:underline"
                  onClick={() => setOpen(false)}
                >
                  Dismiss
                </button>
              </div>
              <p className="leading-relaxed text-slate-700">{data.brief}</p>
              {data.priorities.length > 0 && (
                <ul className="list-disc space-y-1 pl-5 text-slate-600">
                  {data.priorities.map((p) => (
                    <li key={p}>{p}</li>
                  ))}
                </ul>
              )}
              {data.risks.length > 0 && (
                <div>
                  <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-amber-700">
                    Watchouts
                  </p>
                  <ul className="list-disc space-y-1 pl-5 text-slate-600">
                    {data.risks.map((r) => (
                      <li key={r}>{r}</li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          ) : null}
        </div>
      )}
    </div>
  );
}
