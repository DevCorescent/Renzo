"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { motion, AnimatePresence, useReducedMotion } from "framer-motion";
import { Scissors, ArrowRight, Loader2 } from "lucide-react";
import { API } from "@/lib/endpoints";
import { GoogleLoginButton, GOOGLE_ENABLED } from "@/components/shared/google-login-button";
import { HOME_FOR } from "@/lib/auth-paths";
import { AuthInputStyles } from "@/components/auth/auth-input-styles";
import type { ApiResponse, UserType } from "@/types/api";

const EASE = [0.22, 1, 0.36, 1] as const;

type OtpStep = "phone" | "code";
type LoggedInUser = { userType: UserType; name: string | null };

export default function CustomerLoginPage() {
  const router = useRouter();
  const reduce = useReducedMotion();

  const [loading, setLoading] = React.useState(false);
  const [googleLoading, setGoogleLoading] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [otpStep, setOtpStep] = React.useState<OtpStep>("phone");
  const [phone, setPhone] = React.useState("");
  const [otp, setOtp] = React.useState("");
  const [devOtp, setDevOtp] = React.useState<string | null>(null);

  function goHome(user: LoggedInUser) {
    if (user.userType !== "CUSTOMER") {
      setError("This page is for customers only. Use the staff sign-in link.");
      return;
    }
    router.push(HOME_FOR.CUSTOMER);
    router.refresh();
  }

  async function post<T>(url: string, body: unknown): Promise<ApiResponse<T>> {
    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    return res.json();
  }

  async function handleSendOtp(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    try {
      const json = await post<{ devOtp?: string }>(API.auth.otpSend, { phone });
      if (!json.success) throw new Error(json.message);
      setDevOtp(json.data?.devOtp ?? null);
      setOtpStep("code");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not send OTP");
    } finally {
      setLoading(false);
    }
  }

  async function handleVerifyOtp(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    try {
      const json = await post<{ user: LoggedInUser }>(API.auth.otpVerify, {
        phone,
        otp,
      });
      if (!json.success || !json.data) throw new Error(json.message);
      goHome(json.data.user);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Invalid OTP");
    } finally {
      setLoading(false);
    }
  }

  async function handleGoogleCredential(credential: string) {
    setGoogleLoading(true);
    setError(null);
    try {
      const json = await post<{ user: LoggedInUser }>(API.auth.google, {
        credential,
      });
      if (!json.success || !json.data) throw new Error(json.message);
      goHome(json.data.user);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Google sign-in failed");
    } finally {
      setGoogleLoading(false);
    }
  }

  return (
    <div className="relative flex min-h-screen overflow-hidden bg-stone-950 text-stone-100">
      <div
        aria-hidden
        className="pointer-events-none absolute -top-40 right-[-10%] size-[36rem] rounded-full bg-gold/10 blur-3xl"
      />
      <div
        aria-hidden
        className="pointer-events-none absolute bottom-[-20%] left-[-5%] size-[28rem] rounded-full bg-gold/5 blur-3xl"
      />

      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 flex items-center justify-center overflow-hidden"
      >
        <span className="font-heading select-none text-[22vw] font-extrabold leading-none tracking-tighter text-white/[0.025]">
          Renzo
        </span>
      </div>

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
          <p className="font-heading text-4xl font-extrabold leading-tight tracking-tight xl:text-5xl">
            Where Beauty
            <br />
            Meets <span className="text-gold">Confidence</span>
          </p>
          <p className="max-w-xs text-sm leading-relaxed text-stone-400">
            Sign in to book appointments, manage visits, and track your rewards.
          </p>
        </div>

        <p className="text-xs text-stone-600">
          © {new Date().getFullYear()} Renzo. All rights reserved.
        </p>
      </motion.div>

      <div className="relative flex flex-1 flex-col items-center justify-center px-4 py-12 sm:px-8 lg:px-12">
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
          <h1 className="font-heading text-2xl font-bold text-white">
            Customer sign in
          </h1>
          <p className="mt-1 text-sm text-stone-400">
            Use your mobile number or Google account.
          </p>

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

          <AnimatePresence mode="wait">
            {otpStep === "phone" ? (
              <motion.form
                key="otp-phone"
                initial={reduce ? false : { opacity: 0, x: 16 }}
                animate={reduce ? undefined : { opacity: 1, x: 0 }}
                exit={reduce ? undefined : { opacity: 0, x: -16 }}
                transition={{ duration: 0.3, ease: EASE }}
                onSubmit={handleSendOtp}
                className="mt-6 space-y-4"
              >
                <label className="block space-y-1.5">
                  <span className="text-xs font-medium text-stone-400">
                    Mobile number
                  </span>
                  <input
                    type="tel"
                    required
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    placeholder="9990001111"
                    className="auth-input"
                  />
                </label>
                <SubmitButton loading={loading} label="Send code" />
                <p className="text-center text-xs text-stone-500">
                  New here?{" "}
                  <Link href="/signup" className="text-gold hover:underline">
                    Create account
                  </Link>
                </p>
              </motion.form>
            ) : (
              <motion.form
                key="otp-code"
                initial={reduce ? false : { opacity: 0, x: 16 }}
                animate={reduce ? undefined : { opacity: 1, x: 0 }}
                exit={reduce ? undefined : { opacity: 0, x: -16 }}
                transition={{ duration: 0.3, ease: EASE }}
                onSubmit={handleVerifyOtp}
                className="mt-6 space-y-4"
              >
                <p className="text-sm text-stone-300">
                  Code sent to <span className="font-medium text-white">{phone}</span>
                </p>
                <label className="block space-y-1.5">
                  <span className="text-xs font-medium text-stone-400">
                    Enter 6-digit code
                  </span>
                  <input
                    inputMode="numeric"
                    maxLength={6}
                    required
                    value={otp}
                    onChange={(e) => setOtp(e.target.value.replace(/\D/g, ""))}
                    placeholder="123456"
                    className="auth-input text-center font-mono text-xl tracking-[0.5em]"
                  />
                </label>
                {devOtp && (
                  <p className="text-center text-xs text-stone-500">
                    Dev code:{" "}
                    <span className="font-mono font-semibold text-gold">
                      {devOtp}
                    </span>
                  </p>
                )}
                <SubmitButton loading={loading} label="Verify &amp; sign in" />
                <button
                  type="button"
                  onClick={() => {
                    setOtpStep("phone");
                    setOtp("");
                    setError(null);
                  }}
                  className="w-full text-center text-xs text-stone-500 transition-colors hover:text-stone-300"
                >
                  ← Use a different number
                </button>
              </motion.form>
            )}
          </AnimatePresence>

          {GOOGLE_ENABLED && otpStep === "phone" && (
            <div className="mt-6 space-y-4">
              <div className="flex items-center gap-3">
                <span className="h-px flex-1 bg-white/10" />
                <span className="text-[10px] font-semibold uppercase tracking-widest text-stone-600">
                  or
                </span>
                <span className="h-px flex-1 bg-white/10" />
              </div>
              <GoogleLoginButton
                loading={googleLoading}
                onCredential={handleGoogleCredential}
              />
            </div>
          )}

          <div className="mt-8 space-y-3 text-center">
            <p className="text-xs text-stone-600">
              New customer?{" "}
              <Link href="/signup" className="text-gold hover:underline">
                Create your account →
              </Link>
            </p>
            <p className="text-xs text-stone-700">
              <Link
                href="/"
                className="transition-colors hover:text-stone-500"
              >
                ← Back to home
              </Link>
              {" · "}
              <Link
                href="/book"
                className="transition-colors hover:text-stone-500"
              >
                Book without an account
              </Link>
            </p>
          </div>
        </motion.div>
      </div>

      <AuthInputStyles />
    </div>
  );
}

function SubmitButton({ loading, label }: { loading: boolean; label: string }) {
  return (
    <motion.button
      type="submit"
      disabled={loading}
      whileHover={{ scale: 1.01 }}
      whileTap={{ scale: 0.98 }}
      className="flex w-full items-center justify-center gap-2 rounded-full bg-white py-2.5 text-sm font-semibold text-stone-900 transition-colors hover:bg-white/90 disabled:opacity-60"
    >
      {loading ? <Loader2 className="size-4 animate-spin" /> : null}
      {loading ? (
        "Please wait…"
      ) : (
        <span dangerouslySetInnerHTML={{ __html: label }} />
      )}
      {!loading && <ArrowRight className="size-4" />}
    </motion.button>
  );
}
