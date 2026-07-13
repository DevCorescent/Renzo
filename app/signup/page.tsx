"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { motion, AnimatePresence, useReducedMotion } from "framer-motion";
import { Scissors, ArrowRight, ArrowLeft, Loader2, CheckCircle2 } from "lucide-react";
import { API } from "@/lib/endpoints";
import type { ApiResponse, UserType } from "@/types/api";

const EASE = [0.22, 1, 0.36, 1] as const;
const HOME_CUSTOMER = "/customer/dashboard";

type Step = "phone" | "otp" | "done";
type LoggedInUser = { userType: UserType; name: string | null };

export default function SignupPage() {
  const router = useRouter();
  const reduce = useReducedMotion();

  const [step, setStep] = React.useState<Step>("phone");
  const [phone, setPhone] = React.useState("");
  const [digits, setDigits] = React.useState(["", "", "", "", "", ""]);
  const [devOtp, setDevOtp] = React.useState<string | null>(null);
  const [userName, setUserName] = React.useState<string | null>(null);
  const [loading, setLoading] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [countdown, setCountdown] = React.useState(0);
  const inputRefs = React.useRef<(HTMLInputElement | null)[]>([]);
  const phoneRef = React.useRef<HTMLInputElement>(null);
  const timerRef = React.useRef<ReturnType<typeof setInterval> | null>(null);

  // Countdown for resend
  function startCountdown(s = 30) {
    setCountdown(s);
    if (timerRef.current) clearInterval(timerRef.current);
    timerRef.current = setInterval(() => {
      setCountdown((c) => {
        if (c <= 1) { clearInterval(timerRef.current!); return 0; }
        return c - 1;
      });
    }, 1000);
  }
  React.useEffect(() => () => { if (timerRef.current) clearInterval(timerRef.current); }, []);

  const otpValue = digits.join("");

  function handleDigitChange(i: number, val: string) {
    const ch = val.replace(/\D/g, "").slice(-1);
    const next = [...digits];
    next[i] = ch;
    setDigits(next);
    if (ch && i < 5) inputRefs.current[i + 1]?.focus();
  }

  function handleDigitKeyDown(i: number, e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === "Backspace" && !digits[i] && i > 0) inputRefs.current[i - 1]?.focus();
    if (e.key === "ArrowLeft" && i > 0) inputRefs.current[i - 1]?.focus();
    if (e.key === "ArrowRight" && i < 5) inputRefs.current[i + 1]?.focus();
  }

  function handleDigitPaste(e: React.ClipboardEvent) {
    const pasted = e.clipboardData.getData("text").replace(/\D/g, "").slice(0, 6);
    if (!pasted) return;
    e.preventDefault();
    const next = [...digits];
    for (let i = 0; i < 6; i++) next[i] = pasted[i] ?? "";
    setDigits(next);
    const focusIdx = Math.min(pasted.length, 5);
    inputRefs.current[focusIdx]?.focus();
  }

  async function handleSendOtp(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true); setError(null);
    try {
      const res = await fetch(API.auth.otpSend, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ phone }),
      });
      const data: ApiResponse<{ devOtp?: string }> = await res.json();
      if (!data.success) throw new Error(data.message);
      setDevOtp(data.data?.devOtp ?? null);
      setDigits(["", "", "", "", "", ""]);
      setStep("otp");
      startCountdown(30);
      setTimeout(() => inputRefs.current[0]?.focus(), 300);
    } catch (e) { setError(e instanceof Error ? e.message : "Could not send OTP"); }
    finally { setLoading(false); }
  }

  async function handleVerifyOtp(e: React.FormEvent) {
    e.preventDefault();
    if (otpValue.length < 6) return;
    setLoading(true); setError(null);
    try {
      const res = await fetch(API.auth.otpVerify, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ phone, otp: otpValue }),
      });
      const data: ApiResponse<{ user: LoggedInUser }> = await res.json();
      if (!data.success || !data.data) throw new Error(data.message);
      setUserName(data.data.user.name);
      setStep("done");
      setTimeout(() => { router.push(HOME_CUSTOMER); router.refresh(); }, 2200);
    } catch (e) { setError(e instanceof Error ? e.message : "Invalid code"); }
    finally { setLoading(false); }
  }

  async function handleResend() {
    if (countdown > 0) return;
    setLoading(true); setError(null);
    try {
      const res = await fetch(API.auth.otpSend, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ phone }),
      });
      const data: ApiResponse<{ devOtp?: string }> = await res.json();
      if (!data.success) throw new Error(data.message);
      setDevOtp(data.data?.devOtp ?? null);
      setDigits(["", "", "", "", "", ""]);
      startCountdown(30);
      setTimeout(() => inputRefs.current[0]?.focus(), 100);
    } catch (e) { setError(e instanceof Error ? e.message : "Failed to resend"); }
    finally { setLoading(false); }
  }

  const STEPS: Step[] = ["phone", "otp", "done"];
  const stepIdx = STEPS.indexOf(step);

  return (
    <div className="relative flex min-h-screen items-center justify-center overflow-hidden bg-stone-950 px-4 py-12 text-stone-100">
      {/* Glows */}
      <div aria-hidden className="pointer-events-none absolute -top-40 right-[-10%] size-[36rem] rounded-full bg-gold/10 blur-3xl" />
      <div aria-hidden className="pointer-events-none absolute bottom-[-20%] left-[-5%] size-[24rem] rounded-full bg-gold/5 blur-3xl" />

      {/* Watermark */}
      <div aria-hidden className="pointer-events-none absolute inset-0 flex items-center justify-center overflow-hidden">
        <span className="font-heading text-[22vw] font-extrabold leading-none tracking-tighter text-white/[0.025] select-none">
          Renzo
        </span>
      </div>

      <motion.div
        initial={reduce ? false : { opacity: 0, y: 32 }}
        animate={reduce ? undefined : { opacity: 1, y: 0 }}
        transition={{ duration: 0.7, ease: EASE }}
        className="relative w-full max-w-md"
      >
        {/* Card */}
        <div className="rounded-3xl border border-white/10 bg-stone-900/60 p-8 shadow-2xl backdrop-blur-md sm:p-10">

          {/* Logo */}
          <Link href="/" className="mb-6 flex items-center gap-2.5">
            <span className="inline-flex size-9 items-center justify-center rounded-full bg-gold/15 text-gold ring-1 ring-gold/30">
              <Scissors className="size-4" />
            </span>
            <span className="font-heading text-xl font-bold text-white">Renzo</span>
          </Link>

          {/* Step dots */}
          {step !== "done" && (
            <div className="mb-6 flex items-center gap-2">
              {[0, 1].map((i) => (
                <React.Fragment key={i}>
                  <motion.div
                    animate={{ backgroundColor: stepIdx >= i ? "oklch(0.7 0.2 47)" : "rgb(68 64 60)" }}
                    transition={{ duration: 0.4 }}
                    className="size-2 rounded-full"
                  />
                  {i < 1 && <div className={`h-px flex-1 rounded-full transition-colors duration-500 ${stepIdx > i ? "bg-gold/60" : "bg-stone-700"}`} />}
                </React.Fragment>
              ))}
              <span className="ml-2 text-[11px] text-stone-500">Step {stepIdx + 1} of 2</span>
            </div>
          )}

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

          {/* Steps */}
          <AnimatePresence mode="wait">

            {step === "phone" && (
              <motion.div
                key="phone"
                initial={reduce ? false : { opacity: 0, x: 24 }}
                animate={reduce ? undefined : { opacity: 1, x: 0 }}
                exit={reduce ? undefined : { opacity: 0, x: -24 }}
                transition={{ duration: 0.35, ease: EASE }}
              >
                <h1 className="font-heading text-2xl font-bold text-white">Create account</h1>
                <p className="mt-1 mb-6 text-sm text-stone-400">Enter your mobile number — we'll send a one-time code.</p>

                <form onSubmit={handleSendOtp} className="space-y-4">
                  <label className="block space-y-1.5">
                    <span className="text-xs font-medium text-stone-400">Mobile number</span>
                    <input
                      ref={phoneRef}
                      type="tel" required autoFocus
                      value={phone} onChange={(e) => setPhone(e.target.value)}
                      placeholder="9990001111"
                      className="auth-input"
                    />
                  </label>

                  <motion.button
                    type="submit" disabled={loading}
                    whileHover={{ scale: 1.01 }} whileTap={{ scale: 0.98 }}
                    className="flex w-full items-center justify-center gap-2 rounded-full bg-white py-2.5 text-sm font-semibold text-stone-900 hover:bg-white/90 disabled:opacity-60"
                  >
                    {loading ? <Loader2 className="size-4 animate-spin" /> : null}
                    {loading ? "Sending…" : "Send code"}
                    {!loading && <ArrowRight className="size-4" />}
                  </motion.button>
                </form>

                <p className="mt-6 text-center text-xs text-stone-500">
                  Already have an account?{" "}
                  <Link href="/login" className="text-gold hover:underline">Sign in</Link>
                </p>
              </motion.div>
            )}

            {step === "otp" && (
              <motion.div
                key="otp"
                initial={reduce ? false : { opacity: 0, x: 24 }}
                animate={reduce ? undefined : { opacity: 1, x: 0 }}
                exit={reduce ? undefined : { opacity: 0, x: -24 }}
                transition={{ duration: 0.35, ease: EASE }}
              >
                <button
                  type="button"
                  onClick={() => { setStep("phone"); setError(null); }}
                  className="mb-4 flex items-center gap-1.5 text-xs text-stone-500 hover:text-stone-300 transition-colors"
                >
                  <ArrowLeft className="size-3" /> Change number
                </button>

                <h1 className="font-heading text-2xl font-bold text-white">Enter the code</h1>
                <p className="mt-1 mb-6 text-sm text-stone-400">
                  Sent to <span className="font-medium text-white">{phone}</span>
                </p>

                <form onSubmit={handleVerifyOtp} className="space-y-6">
                  {/* OTP digit boxes */}
                  <div className="flex gap-2.5 justify-center">
                    {digits.map((d, i) => (
                      <motion.input
                        key={i}
                        ref={(el) => { inputRefs.current[i] = el; }}
                        type="text" inputMode="numeric" maxLength={1}
                        value={d}
                        onChange={(e) => handleDigitChange(i, e.target.value)}
                        onKeyDown={(e) => handleDigitKeyDown(i, e)}
                        onPaste={handleDigitPaste}
                        initial={reduce ? false : { opacity: 0, y: 12 }}
                        animate={reduce ? undefined : { opacity: 1, y: 0 }}
                        transition={{ duration: 0.3, delay: i * 0.06, ease: EASE }}
                        className="otp-box"
                      />
                    ))}
                  </div>

                  {devOtp && (
                    <p className="text-center text-xs text-stone-500">
                      Dev code: <button type="button" onClick={() => {
                        const arr = devOtp.split("").slice(0, 6);
                        setDigits(arr.concat(Array(6 - arr.length).fill("")));
                      }} className="font-mono font-semibold text-gold hover:underline">
                        {devOtp}
                      </button> (click to fill)
                    </p>
                  )}

                  <motion.button
                    type="submit"
                    disabled={loading || otpValue.length < 6}
                    whileHover={{ scale: otpValue.length === 6 ? 1.01 : 1 }}
                    whileTap={{ scale: 0.98 }}
                    className="flex w-full items-center justify-center gap-2 rounded-full bg-white py-2.5 text-sm font-semibold text-stone-900 hover:bg-white/90 disabled:opacity-40 transition-opacity"
                  >
                    {loading ? <Loader2 className="size-4 animate-spin" /> : null}
                    {loading ? "Verifying…" : "Verify & continue"}
                    {!loading && <ArrowRight className="size-4" />}
                  </motion.button>
                </form>

                <div className="mt-4 text-center">
                  {countdown > 0 ? (
                    <p className="text-xs text-stone-500">Resend in <span className="font-mono text-stone-400">{countdown}s</span></p>
                  ) : (
                    <button type="button" onClick={handleResend} disabled={loading}
                      className="text-xs text-gold hover:underline disabled:opacity-50">
                      Resend code
                    </button>
                  )}
                </div>
              </motion.div>
            )}

            {step === "done" && (
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
                  className="font-heading text-2xl font-bold text-white"
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

        {/* Bottom links */}
        {step !== "done" && (
          <div className="mt-6 space-y-2 text-center">
            <p className="text-xs text-stone-600">
              Staff or admin?{" "}
              <Link href="/login" className="text-stone-400 hover:text-gold transition-colors">Sign in here</Link>
            </p>
            <p className="text-xs text-stone-700">
              <Link href="/" className="hover:text-stone-500 transition-colors">← Back to home</Link>
            </p>
          </div>
        )}
      </motion.div>

      <style>{`
        .auth-input {
          width: 100%;
          background: rgb(12 10 9 / 0.6);
          border: 1px solid rgb(255 255 255 / 0.1);
          border-radius: 0.75rem;
          padding: 0.65rem 0.9rem;
          font-size: 0.875rem;
          color: #f5f5f4;
          outline: none;
          transition: border-color 0.2s, box-shadow 0.2s;
        }
        .auth-input::placeholder { color: #57534e; }
        .auth-input:focus {
          border-color: oklch(0.7 0.2 47 / 0.5);
          box-shadow: 0 0 0 3px oklch(0.7 0.2 47 / 0.12);
        }
        .otp-box {
          width: 2.75rem;
          height: 3.25rem;
          background: rgb(12 10 9 / 0.6);
          border: 1px solid rgb(255 255 255 / 0.12);
          border-radius: 0.65rem;
          font-size: 1.25rem;
          font-weight: 600;
          color: #f5f5f4;
          text-align: center;
          outline: none;
          transition: border-color 0.2s, box-shadow 0.2s, transform 0.15s;
          caret-color: oklch(0.7 0.2 47);
        }
        .otp-box:focus {
          border-color: oklch(0.7 0.2 47 / 0.6);
          box-shadow: 0 0 0 3px oklch(0.7 0.2 47 / 0.15);
          transform: scale(1.06);
        }
        .otp-box:not(:placeholder-shown) {
          border-color: oklch(0.7 0.2 47 / 0.35);
          background: oklch(0.7 0.2 47 / 0.08);
        }
      `}</style>
    </div>
  );
}
