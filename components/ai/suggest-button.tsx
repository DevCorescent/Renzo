"use client";

import * as React from "react";
import { Loader2, Sparkles } from "lucide-react";
import { useAiEnabled } from "@/components/ai/use-ai-enabled";

type SuggestButtonProps = {
  label?: string;
  loadingLabel?: string;
  disabled?: boolean;
  className?: string;
  hideWhenUnavailable?: boolean;
  onSuggest: () => Promise<void> | void;
};

export function SuggestButton({
  label = "Suggest with AI",
  loadingLabel = "Generating…",
  disabled,
  className,
  hideWhenUnavailable = true,
  onSuggest,
}: SuggestButtonProps) {
  const { enabled, loading: checking } = useAiEnabled();
  const [busy, setBusy] = React.useState(false);

  if (checking) return null;
  if (!enabled && hideWhenUnavailable) return null;

  async function handleClick() {
    if (busy || disabled || !enabled) return;
    setBusy(true);
    try {
      await onSuggest();
    } finally {
      setBusy(false);
    }
  }

  return (
    <button
      type="button"
      disabled={busy || disabled || !enabled}
      onClick={handleClick}
      title={!enabled ? "AI is not configured" : undefined}
      className={
        className ??
        "inline-flex items-center gap-1.5 rounded border border-gray-200 bg-white px-3 py-1.5 text-xs font-medium text-gray-800 hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-50"
      }
    >
      {busy ? <Loader2 className="size-3.5 animate-spin" /> : <Sparkles className="size-3.5" />}
      {busy ? loadingLabel : label}
    </button>
  );
}
