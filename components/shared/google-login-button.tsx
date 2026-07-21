"use client";

import * as React from "react";
import { Loader2 } from "lucide-react";

// OWNER: Shalmon | MODULE: Auth — "Continue with Google" (customer login only)
// Renders a fully custom-styled button that triggers google.accounts.id.prompt()
// instead of using GIS's renderButton — we get complete visual control (no GIS
// white border) while the auth mechanism is identical: the initialize() callback
// fires with the ID token, which the parent sends to POST /api/v1/auth/google.

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
      prompt: (
        momentListener?: (notification: {
          isNotDisplayed: () => boolean;
          isSkippedMoment: () => boolean;
        }) => void
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

export const GOOGLE_ENABLED = CLIENT_ID.length > 0;

let gsiPromise: Promise<GoogleIdentityServices> | null = null;

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
    gsiPromise = null;
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
  const [ready, setReady] = React.useState(false);
  const [scriptError, setScriptError] = React.useState<string | null>(null);

  const onCredentialRef = React.useRef(onCredential);
  React.useEffect(() => {
    onCredentialRef.current = onCredential;
  }, [onCredential]);

  React.useEffect(() => {
    if (!GOOGLE_ENABLED) return;
    let cancelled = false;

    loadGsi()
      .then((google) => {
        if (cancelled) return;
        google.accounts.id.initialize({
          client_id: CLIENT_ID,
          callback: ({ credential }) => {
            if (credential) onCredentialRef.current(credential);
          },
          auto_select: false,
          cancel_on_tap_outside: true,
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

  function handleClick() {
    window.google?.accounts.id.prompt();
  }

  if (!GOOGLE_ENABLED) return null;

  if (scriptError) {
    return (
      <p className="rounded-xl border border-white/10 bg-stone-900/60 px-4 py-2.5 text-center text-xs text-stone-500">
        {scriptError}
      </p>
    );
  }

  const disabled = loading || !ready;

  return (
    <button
      type="button"
      onClick={handleClick}
      disabled={disabled}
      className="flex w-full items-center justify-center gap-3 rounded-full border border-stone-700/60 bg-stone-800/70 py-3 text-sm font-semibold text-stone-100 transition hover:bg-stone-700/70 disabled:cursor-not-allowed disabled:opacity-50"
    >
      {disabled ? (
        <>
          <Loader2 className="size-4 animate-spin" />
          {loading ? "Signing you in…" : "Loading Google…"}
        </>
      ) : (
        <>
          <GoogleLogo />
          Continue with Google
        </>
      )}
    </button>
  );
}

function GoogleLogo() {
  return (
    <svg
      width="18"
      height="18"
      viewBox="0 0 18 18"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden="true"
    >
      <path
        fill="#4285F4"
        d="M17.64 9.204c0-.638-.057-1.252-.164-1.841H9v3.481h4.844c-.209 1.125-.843 2.078-1.796 2.716v2.259h2.908c1.702-1.567 2.684-3.875 2.684-6.615Z"
      />
      <path
        fill="#34A853"
        d="M9 18c2.43 0 4.467-.806 5.956-2.18l-2.908-2.259c-.806.54-1.837.86-3.048.86-2.344 0-4.328-1.584-5.036-3.711H.957v2.332C2.438 15.983 5.482 18 9 18Z"
      />
      <path
        fill="#FBBC05"
        d="M3.964 10.71c-.18-.54-.282-1.117-.282-1.71s.102-1.17.282-1.71V4.958H.957C.347 6.173 0 7.548 0 9s.348 2.827.957 4.042l3.007-2.332Z"
      />
      <path
        fill="#EA4335"
        d="M9 3.58c1.321 0 2.508.454 3.44 1.345l2.582-2.58C13.463.891 11.426 0 9 0 5.482 0 2.438 2.017.957 4.958L3.964 7.29C4.672 5.163 6.656 3.58 9 3.58Z"
      />
    </svg>
  );
}
