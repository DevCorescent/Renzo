"use client";

import { useId, useState } from "react";
import { ChevronDown } from "lucide-react";
import { cn } from "@/lib/utils";

export function Disclosure({ title, content }: { title: string; content: string }) {
  const [open, setOpen] = useState(false);
  // Ties the trigger to the panel it controls so a screen reader announces both
  // the expanded state and the answer it reveals.
  const panelId = useId();

  return (
    <div className="rounded-2xl border border-white/10 bg-white/[0.04] px-5 py-4">
      <button
        type="button"
        aria-expanded={open}
        aria-controls={panelId}
        className="flex w-full items-center justify-between gap-4 text-left"
        onClick={() => setOpen((value) => !value)}
      >
        <span className="font-medium text-white">{title}</span>
        <ChevronDown className={cn("size-5 shrink-0 text-stone-400 transition-transform", open && "rotate-180")} />
      </button>
      {open ? (
        <p id={panelId} className="mt-4 text-sm leading-7 text-stone-400">
          {content}
        </p>
      ) : null}
    </div>
  );
}
