"use client";

import * as React from "react";
import { API } from "@/lib/endpoints";

type AiStatus = { enabled: boolean } | null;

let cached: AiStatus = null;
let inflight: Promise<boolean> | null = null;

export async function fetchAiEnabled(): Promise<boolean> {
  if (cached) return cached.enabled;
  if (inflight) return inflight;

  inflight = fetch(API.ai.status)
    .then((r) => r.json())
    .then((j) => {
      const enabled = Boolean(j?.success && j?.data?.enabled);
      cached = { enabled };
      return enabled;
    })
    .catch(() => {
      cached = { enabled: false };
      return false;
    })
    .finally(() => {
      inflight = null;
    });

  return inflight;
}

/** Returns whether Groq AI is configured; false until checked or if unavailable. */
export function useAiEnabled(): { enabled: boolean; loading: boolean } {
  const [enabled, setEnabled] = React.useState(false);
  const [loading, setLoading] = React.useState(true);

  React.useEffect(() => {
    let cancelled = false;
    fetchAiEnabled().then((v) => {
      if (!cancelled) {
        setEnabled(v);
        setLoading(false);
      }
    });
    return () => {
      cancelled = true;
    };
  }, []);

  return { enabled, loading };
}
