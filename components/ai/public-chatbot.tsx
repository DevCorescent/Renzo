"use client";

import * as React from "react";
import { MessageCircle, X, Send, Loader2 } from "lucide-react";
import { API } from "@/lib/endpoints";
import { useAiEnabled } from "@/components/ai/use-ai-enabled";

type Msg = { role: "user" | "assistant"; content: string };

export function PublicChatbot() {
  const { enabled, loading: checking } = useAiEnabled();
  const [open, setOpen] = React.useState(false);
  const [input, setInput] = React.useState("");
  const [busy, setBusy] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [messages, setMessages] = React.useState<Msg[]>([
    {
      role: "assistant",
      content: "Hi! I'm Renzo's assistant. Ask about bookings, services, stylists, or branches.",
    },
  ]);
  const bottomRef = React.useRef<HTMLDivElement>(null);

  React.useEffect(() => {
    if (open) bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, open]);

  if (checking || !enabled) return null;

  async function send() {
    const text = input.trim();
    if (!text || busy) return;

    const next: Msg[] = [...messages, { role: "user", content: text }];
    setMessages(next);
    setInput("");
    setBusy(true);
    setError(null);

    try {
      const res = await fetch(API.ai.chat, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          messages: next
            .filter((m) => m.role === "user" || m.role === "assistant")
            .map((m) => ({ role: m.role, content: m.content })),
        }),
      });
      const json = await res.json();
      if (!res.ok || !json.success) {
        setError(json.message ?? "Something went wrong");
        return;
      }
      setMessages((prev) => [...prev, { role: "assistant", content: json.data.reply }]);
    } catch {
      setError("Network error");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="fixed bottom-5 right-5 z-50 flex flex-col items-end gap-3">
      {open && (
        <div className="flex h-[min(28rem,70vh)] w-[min(22rem,calc(100vw-2.5rem))] flex-col overflow-hidden rounded-2xl border border-white/10 bg-stone-950 shadow-2xl shadow-black/50">
          <div className="flex items-center justify-between border-b border-white/10 px-4 py-3">
            <div>
              <p className="text-sm font-semibold text-stone-100">Renzo Assistant</p>
              <p className="text-[11px] text-stone-500">Salon booking FAQ</p>
            </div>
            <button
              type="button"
              onClick={() => setOpen(false)}
              className="rounded-lg p-1.5 text-stone-400 hover:bg-white/5 hover:text-stone-200"
              aria-label="Close chat"
            >
              <X className="size-4" />
            </button>
          </div>

          <div className="flex-1 space-y-3 overflow-y-auto px-3 py-3">
            {messages.map((m, i) => (
              <div
                key={`${i}-${m.role}`}
                className={`max-w-[90%] rounded-2xl px-3 py-2 text-sm leading-relaxed ${
                  m.role === "user"
                    ? "ml-auto bg-amber-500/15 text-amber-100"
                    : "bg-stone-900 text-stone-300"
                }`}
              >
                {m.content}
              </div>
            ))}
            {busy && (
              <div className="inline-flex items-center gap-2 rounded-2xl bg-stone-900 px-3 py-2 text-xs text-stone-500">
                <Loader2 className="size-3.5 animate-spin" /> Thinking…
              </div>
            )}
            {error && <p className="text-xs text-red-400">{error}</p>}
            <div ref={bottomRef} />
          </div>

          <form
            className="flex gap-2 border-t border-white/10 p-3"
            onSubmit={(e) => {
              e.preventDefault();
              void send();
            }}
          >
            <input
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="Ask about booking…"
              maxLength={2000}
              className="min-w-0 flex-1 rounded-xl border border-white/10 bg-stone-900 px-3 py-2 text-sm text-stone-100 placeholder:text-stone-600 focus:border-amber-500/40 focus:outline-none"
            />
            <button
              type="submit"
              disabled={busy || !input.trim()}
              className="rounded-xl bg-amber-500/90 px-3 text-stone-950 disabled:opacity-40"
              aria-label="Send"
            >
              <Send className="size-4" />
            </button>
          </form>
        </div>
      )}

      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex size-12 items-center justify-center rounded-full bg-amber-500 text-stone-950 shadow-lg shadow-amber-900/30 transition hover:bg-amber-400"
        aria-label={open ? "Close Renzo assistant" : "Open Renzo assistant"}
      >
        {open ? <X className="size-5" /> : <MessageCircle className="size-5" />}
      </button>
    </div>
  );
}
