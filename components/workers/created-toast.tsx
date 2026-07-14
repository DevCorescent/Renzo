"use client";

// Success toast after a worker is admitted.
//
// The Server Action redirects to ?created=<name>; this reads it, announces it, and
// strips the param so a refresh or a back-navigation does not re-announce a
// creation that already happened. No toast library is installed, and pulling one
// in to carry a single string would be a poor trade.

import * as React from "react";
import { useRouter, useSearchParams, usePathname } from "next/navigation";
import { Check, X } from "lucide-react";

const DISMISS_AFTER_MS = 5000;

export function CreatedToast() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const created = searchParams.get("created");
  const [visible, setVisible] = React.useState(Boolean(created));

  const dismiss = React.useCallback(() => {
    setVisible(false);

    // Drop only `created`, so the caller's filters, sort and page survive.
    const params = new URLSearchParams(searchParams.toString());
    params.delete("created");

    const query = params.toString();
    router.replace(query ? `${pathname}?${query}` : pathname, { scroll: false });
  }, [router, pathname, searchParams]);

  React.useEffect(() => {
    if (!created) return;

    const timer = setTimeout(dismiss, DISMISS_AFTER_MS);
    return () => clearTimeout(timer);
  }, [created, dismiss]);

  if (!created || !visible) return null;

  return (
    // role=status, not alert: this is a confirmation, not an error, so a screen
    // reader should announce it politely rather than interrupt.
    <div
      role="status"
      aria-live="polite"
      className="flex items-center justify-between gap-3 rounded border border-green-100 bg-green-50 px-3 py-2"
    >
      <p className="flex items-center gap-2 text-xs text-green-800">
        <Check className="size-3.5 shrink-0" aria-hidden="true" />
        <span>
          <span className="font-medium">{created}</span> was added to your branch.
        </span>
      </p>

      <button
        type="button"
        onClick={dismiss}
        aria-label="Dismiss"
        className="rounded p-0.5 text-green-700/60 transition hover:bg-green-100 hover:text-green-900 focus:outline-none focus:ring-2 focus:ring-green-900/10"
      >
        <X className="size-3.5" />
      </button>
    </div>
  );
}
