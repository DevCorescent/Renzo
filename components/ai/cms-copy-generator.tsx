"use client";

import * as React from "react";
import { API } from "@/lib/endpoints";
import { SuggestButton } from "@/components/ai/suggest-button";

type Kind = "banner" | "blog" | "offer";

export function CmsCopyGenerator({ defaultKind = "banner" }: { defaultKind?: Kind }) {
  const [topic, setTopic] = React.useState("");
  const [tone, setTone] = React.useState("premium and welcoming");
  const [kind, setKind] = React.useState<Kind>(defaultKind);
  const [title, setTitle] = React.useState("");
  const [body, setBody] = React.useState("");
  const [error, setError] = React.useState<string | null>(null);

  async function run() {
    setError(null);
    if (!topic.trim()) {
      setError("Enter a topic first");
      return;
    }
    const res = await fetch(API.ai.cmsCopy, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify({ topic: topic.trim(), tone: tone.trim() || undefined, kind }),
    });
    const json = await res.json();
    if (!res.ok || !json.success) {
      setError(json.message ?? "Failed to generate copy");
      return;
    }
    setTitle(json.data.title ?? "");
    setBody(json.data.body ?? "");
  }

  return (
    <div className="space-y-3 rounded border border-gray-200 bg-white p-4">
      <div className="flex flex-wrap items-end justify-between gap-2">
        <div>
          <p className="text-sm font-semibold text-gray-900">Generate with AI</p>
          <p className="text-xs text-gray-500">Draft title + body for CMS (demo fill)</p>
        </div>
        <SuggestButton label="Generate with AI" disabled={!topic.trim()} onSuggest={run} />
      </div>

      <div className="grid gap-3 sm:grid-cols-3">
        <label className="block text-xs text-gray-600 sm:col-span-2">
          Topic
          <input
            value={topic}
            onChange={(e) => setTopic(e.target.value)}
            placeholder="e.g. Summer hair colour festival"
            className="mt-1 w-full rounded border border-gray-200 px-3 py-2 text-sm text-gray-900"
          />
        </label>
        <label className="block text-xs text-gray-600">
          Kind
          <select
            value={kind}
            onChange={(e) => setKind(e.target.value as Kind)}
            className="mt-1 w-full rounded border border-gray-200 px-3 py-2 text-sm text-gray-900"
          >
            <option value="banner">Banner</option>
            <option value="blog">Blog</option>
            <option value="offer">Offer</option>
          </select>
        </label>
      </div>

      <label className="block text-xs text-gray-600">
        Tone
        <input
          value={tone}
          onChange={(e) => setTone(e.target.value)}
          className="mt-1 w-full rounded border border-gray-200 px-3 py-2 text-sm text-gray-900"
        />
      </label>

      {error && <p className="text-xs text-red-600">{error}</p>}

      <label className="block text-xs text-gray-600">
        Title
        <input
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          className="mt-1 w-full rounded border border-gray-200 px-3 py-2 text-sm text-gray-900"
          placeholder="Generated title appears here"
        />
      </label>
      <label className="block text-xs text-gray-600">
        Body
        <textarea
          value={body}
          onChange={(e) => setBody(e.target.value)}
          rows={5}
          className="mt-1 w-full rounded border border-gray-200 px-3 py-2 text-sm text-gray-900"
          placeholder="Generated body appears here"
        />
      </label>
    </div>
  );
}
