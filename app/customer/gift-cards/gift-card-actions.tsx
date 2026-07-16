"use client";

import * as React from "react";
import { Gift, Ticket } from "lucide-react";

// OWNER: Devanshi | Gift card redeem + buy actions (client, UI-only until billing API lands)
export function GiftCardActions() {
  const [code, setCode] = React.useState("");
  const [msg, setMsg] = React.useState<string | null>(null);

  function redeem(e: React.FormEvent) {
    e.preventDefault();
    if (!code.trim()) {
      setMsg("Please enter a gift card code.");
      return;
    }
    setMsg(`Code “${code.trim()}” submitted — redemption will be enabled soon.`);
  }

  return (
    <div className="grid gap-4 sm:grid-cols-2">
      {/* Redeem */}
      <form onSubmit={redeem} className="rounded-xl border border-white/8 bg-stone-900 p-4">
        <div className="mb-3 flex items-center gap-2">
          <span className="flex size-8 items-center justify-center rounded-lg bg-white/5 text-[#C4C9D1]">
            <Ticket className="size-4" />
          </span>
          <div>
            <p className="text-sm font-semibold text-stone-100">Redeem a gift card</p>
            <p className="text-xs text-stone-500">Enter your code to add its balance</p>
          </div>
        </div>
        <div className="flex gap-2">
          <input
            value={code}
            onChange={(e) => { setCode(e.target.value.toUpperCase()); setMsg(null); }}
            placeholder="GIFT-XXXX-XXXX"
            className="min-w-0 flex-1 rounded-lg border border-white/10 bg-stone-950 px-3 py-2 font-mono text-sm tracking-widest text-stone-100 placeholder:text-stone-600 outline-none transition focus:border-[#C4C9D1]"
          />
          <button
            type="submit"
            className="shrink-0 rounded-lg bg-[#C4C9D1] px-4 py-2 text-sm font-semibold text-stone-950 transition hover:bg-[#dcdedd]"
          >
            Redeem
          </button>
        </div>
        {msg && <p className="mt-2 text-xs text-stone-400">{msg}</p>}
      </form>

      {/* Buy */}
      <div className="flex flex-col rounded-xl border border-white/8 bg-stone-900 p-4">
        <div className="mb-3 flex items-center gap-2">
          <span className="flex size-8 items-center justify-center rounded-lg bg-white/5 text-[#C4C9D1]">
            <Gift className="size-4" />
          </span>
          <div>
            <p className="text-sm font-semibold text-stone-100">Buy a gift card</p>
            <p className="text-xs text-stone-500">Gift beauty to someone special</p>
          </div>
        </div>
        <p className="flex-1 text-xs text-stone-500">
          Choose an amount and send a Renzo gift card to friends or family.
        </p>
        <button
          type="button"
          className="mt-3 w-full rounded-lg border border-[#C4C9D1]/40 py-2 text-sm font-semibold text-[#C4C9D1] transition hover:bg-[#C4C9D1]/10"
        >
          Buy a gift card
        </button>
      </div>
    </div>
  );
}
