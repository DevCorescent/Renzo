"use client";

import * as React from "react";
import { API } from "@/lib/endpoints";
import { SuggestButton } from "@/components/ai/suggest-button";

export function ReviewInsightsPanel() {
  const [open, setOpen] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [data, setData] = React.useState<{
    summary: string;
    themes: string[];
    sentiment: string;
    actionItems: string[];
    count: number;
  } | null>(null);

  async function run() {
    setError(null);
    const res = await fetch(API.ai.reviewInsights, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify({}),
    });
    const json = await res.json();
    if (!res.ok || !json.success) {
      setError(json.message ?? "Failed to generate insights");
      setOpen(true);
      return;
    }
    setData(json.data);
    setOpen(true);
  }

  return (
    <div className="space-y-3">
      <SuggestButton label="AI review insights" onSuggest={run} />
      {open && (
        <div className="rounded border border-gray-200 bg-white p-4 text-sm">
          {error ? (
            <p className="text-red-600">{error}</p>
          ) : data ? (
            <div className="space-y-3">
              <div className="flex items-center justify-between gap-2">
                <p className="font-medium text-gray-900">
                  Insights · {data.count} pending · {data.sentiment}
                </p>
                <button
                  type="button"
                  className="text-xs text-gray-500 hover:underline"
                  onClick={() => setOpen(false)}
                >
                  Dismiss
                </button>
              </div>
              <p className="text-gray-700 leading-relaxed">{data.summary}</p>
              {data.themes.length > 0 && (
                <ul className="list-disc space-y-1 pl-5 text-gray-600">
                  {data.themes.map((t) => (
                    <li key={t}>{t}</li>
                  ))}
                </ul>
              )}
              {data.actionItems.length > 0 && (
                <div>
                  <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-gray-500">
                    Action items
                  </p>
                  <ul className="list-disc space-y-1 pl-5 text-gray-600">
                    {data.actionItems.map((t) => (
                      <li key={t}>{t}</li>
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
