"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { motion, AnimatePresence, useReducedMotion } from "framer-motion";
import { Scissors, CheckCircle2 } from "lucide-react";
import { API } from "@/lib/endpoints";
import { GoogleLoginButton } from "@/components/shared/google-login-button";
import type { ApiResponse, UserType } from "@/types/api";

const EASE = [0.22, 1, 0.36, 1] as const;
const HOME_CUSTOMER = "/customer/dashboard";

type LoggedInUser = { userType: UserType; name: string | null };

export default function SignupPage() {
  const router = useRouter();
  const reduce = useReducedMotion();

  const [loading, setLoading] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [done, setDone] = React.useState(false);
  const [userName, setUserName] = React.useState<string | null>(null);

  async function handleGoogleCredential(credential: string) {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(API.auth.google, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ credential }),
      });
      const data: ApiResponse<{ user: LoggedInUser }> = await res.json();
      if (!data.success || !data.data) throw new Error(data.message);
      setUserName(data.data.user.name);
      setDone(true);
      setTimeout(() => { router.push(HOME_CUSTOMER); router.refresh(); }, 2200);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Google sign-in failed");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="auth-surface relative flex min-h-screen items-center justify-center overflow-hidden bg-stone-950 px-4 py-12 text-stone-100">
      {/* Glows */}
      <div aria-hidden className="pointer-events-none absolute -top-40 right-[-10%] size-[36rem] rounded-full bg-gold/10 blur-3xl" />
      <div aria-hidden className="pointer-events-none absolute bottom-[-20%] left-[-5%] size-[24rem] rounded-full bg-gold/5 blur-3xl" />

      {/* Watermark */}
      <div aria-hidden className="pointer-events-none absolute inset-0 flex items-center justify-center overflow-hidden">
        <span className="font-heading select-none text-[22vw] font-extrabold leading-none tracking-tighter text-white/[0.025]">
          Renzo
        </span>
      </div>

      <motion.div
        initial={reduce ? false : { opacity: 0, y: 32 }}
        animate={reduce ? undefined : { opacity: 1, y: 0 }}
        transition={{ duration: 0.7, ease: EASE }}
        className="relative w-full max-w-md"
      >
        <div className="rounded-3xl border border-white/10 bg-stone-900/60 p-8 shadow-2xl backdrop-blur-md sm:p-10">
          {/* Logo */}
          <Link href="/" className="mb-8 flex items-center gap-2.5">
            <span className="inline-flex size-9 items-center justify-center rounded-full bg-gold/15 text-gold ring-1 ring-gold/30">
              <Scissors className="size-4" />
            </span>
            <span className="font-heading text-xl font-bold text-white">Renzo</span>
          </Link>

          {/* Error */}
          <AnimatePresence>
            {error && (
              <motion.p
                key="err"
                initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
                className="mb-4 rounded-xl border border-red-500/20 bg-red-500/10 px-4 py-2.5 text-sm text-red-400"
              >
                {error}
              </motion.p>
            )}
          </AnimatePresence>

          <AnimatePresence mode="wait">
            {!done ? (
              <motion.div
                key="signup"
                initial={reduce ? false : { opacity: 0, x: 16 }}
                animate={reduce ? undefined : { opacity: 1, x: 0 }}
                exit={reduce ? undefined : { opacity: 0, x: -16 }}
                transition={{ duration: 0.35, ease: EASE }}
              >
                <h1 className="font-heading text-2xl font-semibold text-white">Create account</h1>
                <p className="mt-1 mb-8 text-sm text-stone-400">
                  Continue with Google to get started — it only takes a second.
                </p>

                <GoogleLoginButton loading={loading} onCredential={handleGoogleCredential} />

                <p className="mt-6 text-center text-xs text-stone-500">
                  Already have an account?{" "}
                  <Link href="/login" className="text-gold hover:underline">Sign in</Link>
                </p>
              </motion.div>
            ) : (
              <motion.div
                key="done"
                initial={reduce ? false : { opacity: 0, scale: 0.95 }}
                animate={reduce ? undefined : { opacity: 1, scale: 1 }}
                transition={{ duration: 0.5, ease: EASE }}
                className="py-4 text-center"
              >
                <motion.div
                  initial={reduce ? false : { scale: 0 }}
                  animate={reduce ? undefined : { scale: 1 }}
                  transition={{ type: "spring", stiffness: 300, damping: 18, delay: 0.1 }}
                  className="mx-auto mb-5 flex size-16 items-center justify-center rounded-full bg-gold/15 text-gold ring-1 ring-gold/30"
                >
                  <CheckCircle2 className="size-8" />
                </motion.div>

                <motion.h2
                  initial={reduce ? false : { opacity: 0, y: 12 }}
                  animate={reduce ? undefined : { opacity: 1, y: 0 }}
                  transition={{ delay: 0.25, duration: 0.5, ease: EASE }}
                  className="font-heading text-2xl font-semibold text-white"
                >
                  Welcome{userName ? `, ${userName}` : ""}!
                </motion.h2>
                <motion.p
                  initial={reduce ? false : { opacity: 0 }}
                  animate={reduce ? undefined : { opacity: 1 }}
                  transition={{ delay: 0.4, duration: 0.5 }}
                  className="mt-2 text-sm text-stone-400"
                >
                  Your account is ready. Taking you to your dashboard…
                </motion.p>
                <motion.div
                  initial={reduce ? false : { scaleX: 0 }}
                  animate={reduce ? undefined : { scaleX: 1 }}
                  transition={{ delay: 0.5, duration: 1.6, ease: "easeInOut" }}
                  style={{ originX: 0 }}
                  className="mx-auto mt-6 h-0.5 w-32 rounded-full bg-gold/50"
                />
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {!done && (
          <div className="mt-6 space-y-2 text-center">
            <p className="text-xs text-stone-600">
              Staff or admin?{" "}
              <Link href="/staff/login" className="text-stone-400 transition-colors hover:text-gold">Sign in here</Link>
            </p>
            <p className="text-xs text-stone-700">
              <Link href="/" className="transition-colors hover:text-stone-500">← Back to home</Link>
            </p>
          </div>
        )}
      </motion.div>
    </div>
  );
}
