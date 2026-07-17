"use client";

// OWNER: Gauransh
// MODULE: Gift Cards — copy code button
// PURPOSE: Copy a GiftCard.code (the customer-facing token) to the clipboard. Used by
//          the admin table/drawer and the customer card. Themeable via className so it
//          fits both the light ERP and the dark customer portal.

import * as React from "react";
import { Copy, Check } from "lucide-react";
import { cn } from "@/lib/utils";

export function CopyCodeButton({
  code, className, label = "Copy code",
}: {
  code: string;
  className?: string;
  label?: string;
}) {
  const [copied, setCopied] = React.useState(false);

  async function copy() {
    try {
      await navigator.clipboard.writeText(code);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Clipboard blocked — no-op; the code is still visible for manual copy.
    }
  }

  return (
    <button
      type="button"
      onClick={copy}
      aria-label={copied ? "Copied" : label}
      title={copied ? "Copied" : label}
      className={cn("inline-flex size-7 items-center justify-center rounded text-gray-400 transition hover:bg-gray-100 hover:text-gray-700 focus:outline-none focus-visible:ring-2 focus-visible:ring-gray-900/10", className)}
    >
      {copied ? <Check className="size-3.5 text-green-600" aria-hidden="true" /> : <Copy className="size-3.5" aria-hidden="true" />}
    </button>
  );
}
