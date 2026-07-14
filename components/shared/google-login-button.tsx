"use client";

import * as React from "react";
import { Loader2 } from "lucide-react";

// OWNER: Shalmon | MODULE: Auth — "Continue with Google" (customer login only)
// Renders Google Identity Services' official button and hands the resulting ID
// token to the parent. Nothing here is trusted: the token is verified
// server-side by POST /api/v1/auth/google before any session is issued.

type CredentialResponse = { credential?: string };

type GoogleIdentityServices = {
  accounts: {
    id: {
      initialize: (config: {
        client_id: string;
        callback: (response: CredentialResponse) => void;
        auto_select?: boolean;
        cancel_on_tap_outside?: boolean;
      }) => void;
      renderButton: (
        parent: HTMLElement,
        options: {
          type?: "standard" | "icon";
          theme?: "outline" | "filled_blue" | "filled_black";
          size?: "small" | "medium" | "large";
          text?: "signin_with" | "signup_with" | "continue_with";
          shape?: "rectangular" | "pill";
          logo_alignment?: "left" | "center";
          width?: number;
        }
      ) => void;
    };
  };
};

declare global {
  interface Window {
    google?: GoogleIdentityServices;
  }
}

const GSI_SRC = "https://accounts.google.com/gsi/client";

// Public (browser-visible) client id. Safe to expose — it is not a secret; the
// GOOGLE_CLIENT_SECRET never leaves the server and is not used by this flow.
const CLIENT_ID = process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID ?? "";

// Lets the login page hide the divider entirely when Google is not configured.
export const GOOGLE_ENABLED = CLIENT_ID.length > 0;

// GIS caps the rendered button at 400px.
const MAX_BUTTON_WIDTH = 400;

let gsiPromise: Promise<GoogleIdentityServices> | null = null;

// Load the GIS script once per page, no matter how many times we mount.
function loadGsi(): Promise<GoogleIdentityServices> {
  if (gsiPromise) return gsiPromise;

  gsiPromise = new Promise<GoogleIdentityServices>((resolve, reject) => {
    if (window.google) return resolve(window.google);

    const existing = document.querySelector<HTMLScriptElement>(
      `script[src="${GSI_SRC}"]`
    );
    const script = existing ?? document.createElement("script");

    script.addEventListener("load", () => {
      if (window.google) resolve(window.google);
      else reject(new Error("Google sign-in failed to initialise"));
    });
    script.addEventListener("error", () =>
      reject(new Error("Could not reach Google sign-in"))
    );

    if (!existing) {
      script.src = GSI_SRC;
      script.async = true;
      script.defer = true;
      document.head.appendChild(script);
    }
  }).catch((e: unknown) => {
    gsiPromise = null; // allow a retry on the next mount
    throw e;
  });

  return gsiPromise;
}

export function GoogleLoginButton({
  onCredential,
  loading,
}: {
  onCredential: (credential: string) => void;
  loading: boolean;
}) {
  const hostRef = React.useRef<HTMLDivElement>(null);
  const [ready, setReady] = React.useState(false);
  const [scriptError, setScriptError] = React.useState<string | null>(null);

  // Keep the latest callback without re-running the (expensive) GIS init.
  const onCredentialRef = React.useRef(onCredential);
  React.useEffect(() => {
    onCredentialRef.current = onCredential;
  }, [onCredential]);

  React.useEffect(() => {
    if (!GOOGLE_ENABLED) return;
    let cancelled = false;

    loadGsi()
      .then((google) => {
        const host = hostRef.current;
        if (cancelled || !host) return;

        google.accounts.id.initialize({
          client_id: CLIENT_ID,
          callback: ({ credential }) => {
            if (credential) onCredentialRef.current(credential);
          },
          auto_select: false,
          cancel_on_tap_outside: true,
        });

        google.accounts.id.renderButton(host, {
          type: "standard",
          theme: "filled_black", // matches the page's dark surface
          size: "large",
          text: "continue_with",
          shape: "pill",
          logo_alignment: "center",
          width: Math.min(host.offsetWidth || MAX_BUTTON_WIDTH, MAX_BUTTON_WIDTH),
        });

        setReady(true);
      })
      .catch((e: unknown) => {
        if (cancelled) return;
        setScriptError(
          e instanceof Error ? e.message : "Could not load Google sign-in"
        );
      });

    return () => {
      cancelled = true;
    };
  }, []);

  if (!GOOGLE_ENABLED) return null;

  if (scriptError) {
    return (
      <p className="rounded-xl border border-white/10 bg-stone-900/60 px-4 py-2.5 text-center text-xs text-stone-500">
        {scriptError}
      </p>
    );
  }

  return (
    <div className="relative flex min-h-[44px] items-center justify-center">
      {/* GIS renders its own (unstyleable) button into this host. */}
      <div
        ref={hostRef}
        aria-busy={loading}
        className={
          loading || !ready
            ? "pointer-events-none w-full opacity-0"
            : "flex w-full justify-center"
        }
      />

      {/* One overlay covers both states: script still loading, and our own
          POST /auth/google in flight. */}
      {(loading || !ready) && (
        <div className="pointer-events-none absolute inset-0 flex items-center justify-center gap-2 rounded-full border border-white/10 bg-stone-900/60 text-sm font-semibold text-stone-400">
          <Loader2 className="size-4 animate-spin" />
          {loading ? "Signing you in…" : "Loading Google…"}
        </div>
      )}
    </div>
  );
}
