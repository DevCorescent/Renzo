"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { motion, AnimatePresence, useReducedMotion } from "framer-motion";
import { Scissors } from "lucide-react";
import { API } from "@/lib/endpoints";
import { GoogleLoginButton } from "@/components/shared/google-login-button";
import { HOME_FOR } from "@/lib/auth-paths";
import type { ApiResponse, UserType } from "@/types/api";

const EASE = [0.22, 1, 0.36, 1] as const;

type LoggedInUser = { userType: UserType; name: string | null };

export default function CustomerLoginPage() {
  const router = useRouter();
  const reduce = useReducedMotion();

  const [loading, setLoading] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  function goHome(user: LoggedInUser) {
    if (user.userType !== "CUSTOMER") {
      setError("This page is for customers only. Use the staff sign-in link.");
      return;
    }
    router.push(HOME_FOR.CUSTOMER);
    router.refresh();
  }

  async function handleGoogleCredential(credential: string) {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(API.auth.google, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ credential }),
      });
      const json: ApiResponse<{ user: LoggedInUser }> = await res.json();
      if (!json.success || !json.data) throw new Error(json.message);
      goHome(json.data.user);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Google sign-in failed");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="auth-surface relative flex min-h-screen overflow-hidden bg-stone-950 text-stone-100">
      {/* Ambient glows */}
      <div
        aria-hidden
        className="pointer-events-none absolute -top-40 right-[-10%] size-[36rem] rounded-full bg-gold/10 blur-3xl"
      />
      <div
        aria-hidden
        className="pointer-events-none absolute bottom-[-20%] left-[-5%] size-[28rem] rounded-full bg-gold/5 blur-3xl"
      />

      {/* Watermark */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 flex items-center justify-center overflow-hidden"
      >
        <span className="font-heading select-none text-[22vw] font-extrabold leading-none tracking-tighter text-white/[0.025]">
          Renzo
        </span>
      </div>

      {/* Left panel — desktop */}
      <motion.div
        initial={reduce ? false : { opacity: 0, x: -40 }}
        animate={reduce ? undefined : { opacity: 1, x: 0 }}
        transition={{ duration: 0.8, ease: EASE }}
        className="relative hidden flex-col justify-between p-12 lg:flex lg:w-[46%]"
      >
        <Link href="/" className="flex items-center gap-2.5">
          <span className="inline-flex size-9 items-center justify-center rounded-full bg-gold/15 text-gold ring-1 ring-gold/30">
            <Scissors className="size-4" />
          </span>
          <span className="font-heading text-2xl font-bold tracking-tight text-white">
            Renzo
          </span>
        </Link>

        <div className="space-y-6">
          <p className="font-heading text-4xl font-semibold tracking-tight xl:text-5xl">
            Where Beauty
            <br />
            Meets{" "}
            <span className="bg-gradient-to-r from-[#EAD7AA] via-[#C8A96A] to-[#F2E2BF] bg-clip-text text-transparent">
              Confidence
            </span>
          </p>
          <p className="max-w-xs text-sm leading-relaxed text-stone-400">
            Sign in to book appointments, manage visits, and track your rewards.
          </p>
        </div>

        <p className="text-xs text-stone-600">
          © {new Date().getFullYear()} Renzo. All rights reserved.
        </p>
      </motion.div>

      {/* Right panel — sign-in card */}
      <div className="relative flex flex-1 flex-col items-center justify-center px-4 py-12 sm:px-8 lg:px-12">
        {/* Mobile logo */}
        <Link href="/" className="mb-10 flex items-center gap-2 lg:hidden">
          <span className="inline-flex size-8 items-center justify-center rounded-full bg-gold/15 text-gold ring-1 ring-gold/30">
            <Scissors className="size-4" />
          </span>
          <span className="font-heading text-xl font-bold text-white">Renzo</span>
        </Link>

        <motion.div
          initial={reduce ? false : { opacity: 0, y: 32 }}
          animate={reduce ? undefined : { opacity: 1, y: 0 }}
          transition={{ duration: 0.7, ease: EASE }}
          className="w-full max-w-md"
        >
          <h1 className="font-heading text-2xl font-semibold text-white">
            Customer sign in
          </h1>
          <p className="mt-1 text-sm text-stone-400">
            Continue with your Google account to access Renzo.
          </p>

          {/* Error */}
          <AnimatePresence>
            {error && (
              <motion.p
                key="err"
                initial={{ opacity: 0, y: -8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0 }}
                className="mt-4 rounded-xl border border-red-500/20 bg-red-500/10 px-4 py-2.5 text-sm text-red-400"
              >
                {error}
              </motion.p>
            )}
          </AnimatePresence>

          {/* Google button */}
          <div className="mt-8">
            <GoogleLoginButton
              loading={loading}
              onCredential={handleGoogleCredential}
            />
          </div>

          {/* Footer links */}
          <div className="mt-10 space-y-3 text-center">
            <p className="text-xs text-stone-600">
              New customer?{" "}
              <Link href="/signup" className="text-gold hover:underline">
                Create your account →
              </Link>
            </p>
            <p className="text-xs text-stone-700">
              <Link href="/" className="transition-colors hover:text-stone-500">
                ← Back to home
              </Link>
              {" · "}
              <Link href="/book" className="transition-colors hover:text-stone-500">
                Book without an account
              </Link>
            </p>
          </div>
        </motion.div>
      </div>
    </div>
  );
}
