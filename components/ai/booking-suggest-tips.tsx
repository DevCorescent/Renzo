"use client";

import * as React from "react";
import { API } from "@/lib/endpoints";
import { SuggestButton } from "@/components/ai/suggest-button";

/** Lightweight booking tips panel for the public book wizard. */
export function BookingSuggestTips({
  serviceName,
  branchId,
}: {
  serviceName: string;
  branchId?: string;
}) {
  const [tips, setTips] = React.useState<string[] | null>(null);
  const [messaging, setMessaging] = React.useState<string | null>(null);
  const [error, setError] = React.useState<string | null>(null);

  async function run() {
    setError(null);
    const res = await fetch(API.ai.bookingSuggest, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ serviceName, branchId }),
    });
    const json = await res.json();
    if (!res.ok || !json.success) {
      setError(json.message ?? "Could not load tips");
      return;
    }
    setTips(json.data.tips ?? []);
    setMessaging(json.data.messaging ?? null);
  }

  return (
    <div className="mb-5 space-y-2">
      <SuggestButton
        label="AI stylist tips"
        className="inline-flex items-center gap-1.5 rounded-xl border border-white/10 bg-stone-900 px-3 py-1.5 text-xs font-medium text-stone-200 hover:border-amber-500/40 hover:text-amber-200 disabled:opacity-50"
        onSuggest={run}
      />
      {error && <p className="text-xs text-red-400">{error}</p>}
      {(tips || messaging) && (
        <div className="rounded-2xl border border-white/8 bg-stone-900/80 px-4 py-3 text-sm text-stone-300">
          {messaging && <p className="mb-2 leading-relaxed">{messaging}</p>}
          {tips && tips.length > 0 && (
            <ul className="list-disc space-y-1 pl-4 text-xs text-stone-400">
              {tips.map((t) => (
                <li key={t}>{t}</li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}
