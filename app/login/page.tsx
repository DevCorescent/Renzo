"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { motion, AnimatePresence, useReducedMotion } from "framer-motion";
import { Scissors, Eye, EyeOff, ArrowRight, Loader2 } from "lucide-react";
import { API } from "@/lib/endpoints";
import { GoogleLoginButton, GOOGLE_ENABLED } from "@/components/shared/google-login-button";
import type { ApiResponse, UserType } from "@/types/api";

const EASE = [0.22, 1, 0.36, 1] as const;

const HOME_FOR: Record<UserType, string> = {
  SUPER_ADMIN:        "/super-admin/dashboard",
  OWNER:              "/branch-admin/dashboard",
  BRANCH_ADMIN:       "/branch-admin/dashboard",
  RECEPTIONIST:       "/reception/dashboard",
  WORKER:             "/worker/dashboard",
  CUSTOMER:           "/customer/dashboard",
  INVENTORY_MANAGER:  "/inventory/dashboard",
  MARKETING_MANAGER:  "/marketing/dashboard",
  ACCOUNTANT:         "/accountant/dashboard",
};

type Tab = "staff" | "customer";
type OtpStep = "phone" | "code";
type LoggedInUser = { userType: UserType; name: string | null };

export default function LoginPage() {
  const router = useRouter();
  const reduce = useReducedMotion();

  const [tab, setTab] = React.useState<Tab>("staff");
  const [showPass, setShowPass] = React.useState(false);
  const [loading, setLoading] = React.useState(false);
  const [googleLoading, setGoogleLoading] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [debug, setDebug] = React.useState<string[]>([]);

  // Staff fields
  const [email, setEmail] = React.useState("");
  const [password, setPassword] = React.useState("");

  // Customer OTP
  const [otpStep, setOtpStep] = React.useState<OtpStep>("phone");
  const [phone, setPhone] = React.useState("");
  const [otp, setOtp] = React.useState("");
  const [devOtp, setDevOtp] = React.useState<string | null>(null);

  function switchTab(t: Tab) {
    setTab(t);
    setError(null);
    setDebug([]);
    setOtpStep("phone");
  }

  function goHome(user: LoggedInUser) {
    const dest = HOME_FOR[user.userType] ?? "/";
    console.log("[login] role:", user.userType, "→", dest);
    setDebug((d) => [...d, `✓ ${user.userType} → ${dest}`]);
    router.push(dest);
    router.refresh();
  }

  async function post<T>(url: string, body: unknown): Promise<ApiResponse<T>> {
    const res = await fetch(url, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
    const data: ApiResponse<T> = await res.json();
    console.log("[login]", url, res.status, data);
    return data;
  }

  async function handleStaffLogin(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true); setError(null); setDebug([]);
    try {
      setDebug((d) => [...d, `→ Signing in as staff…`]);
      const json = await post<{ user: LoggedInUser }>(API.auth.login, { email, password });
      if (!json.success || !json.data) throw new Error(json.message);
      setDebug((d) => [...d, `✓ role: ${json.data!.user.userType}`]);
      goHome(json.data.user);
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Login failed";
      setError(msg); setDebug((d) => [...d, `✗ ${msg}`]);
    } finally { setLoading(false); }
  }

  async function handleSendOtp(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true); setError(null);
    try {
      const json = await post<{ devOtp?: string }>(API.auth.otpSend, { phone });
      if (!json.success) throw new Error(json.message);
      setDevOtp(json.data?.devOtp ?? null);
      setOtpStep("code");
    } catch (e) { setError(e instanceof Error ? e.message : "Could not send OTP"); }
    finally { setLoading(false); }
  }

  async function handleVerifyOtp(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true); setError(null);
    try {
      const json = await post<{ user: LoggedInUser }>(API.auth.otpVerify, { phone, otp });
      if (!json.success || !json.data) throw new Error(json.message);
      goHome(json.data.user);
    } catch (e) { setError(e instanceof Error ? e.message : "Invalid OTP"); }
    finally { setLoading(false); }
  }

  // Google hands us an ID token; the server verifies it and issues the same
  // session cookie as password / OTP login.
  async function handleGoogleCredential(credential: string) {
    setGoogleLoading(true); setError(null); setDebug([]);
    try {
      setDebug((d) => [...d, `→ Verifying Google account…`]);
      const json = await post<{ user: LoggedInUser }>(API.auth.google, { credential });
      if (!json.success || !json.data) throw new Error(json.message);
      goHome(json.data.user);
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Google sign-in failed";
      setError(msg); setDebug((d) => [...d, `✗ ${msg}`]);
    } finally { setGoogleLoading(false); }
  }

  return (
    <div className="relative flex min-h-screen overflow-hidden bg-stone-950 text-stone-100">
      {/* Ambient glow */}
      <div aria-hidden className="pointer-events-none absolute -top-40 right-[-10%] size-[36rem] rounded-full bg-gold/10 blur-3xl" />
      <div aria-hidden className="pointer-events-none absolute bottom-[-20%] left-[-5%] size-[28rem] rounded-full bg-gold/5 blur-3xl" />

      {/* Brand watermark */}
      <div aria-hidden className="pointer-events-none absolute inset-0 flex items-center justify-center overflow-hidden">
        <span className="font-heading text-[22vw] font-extrabold leading-none tracking-tighter text-white/[0.025] select-none">
          Renzo
        </span>
      </div>

      {/* Left decorative panel — desktop only */}
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
          <span className="font-heading text-2xl font-bold tracking-tight text-white">Renzo</span>
        </Link>

        <div className="space-y-6">
          <p className="font-heading text-4xl font-extrabold leading-tight tracking-tight xl:text-5xl">
            Where Beauty<br />
            Meets <span className="text-gold">Confidence</span>
          </p>
          <p className="max-w-xs text-sm leading-relaxed text-stone-400">
            Premium hair &amp; beauty services crafted around you. Sign in to manage your experience.
          </p>

          <div className="flex items-center gap-3 rounded-2xl border border-white/10 bg-stone-900/50 px-4 py-3 backdrop-blur w-fit">
            <div className="size-2 rounded-full bg-gold animate-pulse" />
            <p className="text-xs text-stone-300">Trusted by 2,000+ clients across Mumbai</p>
          </div>
        </div>

        <p className="text-xs text-stone-600">© {new Date().getFullYear()} Renzo. All rights reserved.</p>
      </motion.div>

      {/* Right form panel */}
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
          <h1 className="font-heading text-2xl font-bold text-white">Sign in</h1>
          <p className="mt-1 text-sm text-stone-400">Welcome back. Choose your access type.</p>

          {/* Tab switcher */}
          <div className="mt-6 flex gap-1 rounded-xl border border-white/10 bg-stone-900/60 p-1">
            {(["staff", "customer"] as const).map((t) => (
              <button
                key={t}
                type="button"
                onClick={() => switchTab(t)}
                className="relative flex-1 rounded-lg px-3 py-2 text-xs font-semibold transition-colors duration-200"
              >
                {tab === t && (
                  <motion.span
                    layoutId="tab-pill"
                    className="absolute inset-0 rounded-lg bg-white/10"
                    transition={{ duration: 0.25, ease: EASE }}
                  />
                )}
                <span className={tab === t ? "relative text-white" : "relative text-stone-500"}>
                  {t === "staff" ? "Staff / Admin" : "Customer"}
                </span>
              </button>
            ))}
          </div>

          {/* Error */}
          <AnimatePresence>
            {error && (
              <motion.p
                key="err"
                initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
                className="mt-4 rounded-xl border border-red-500/20 bg-red-500/10 px-4 py-2.5 text-sm text-red-400"
              >
                {error}
              </motion.p>
            )}
          </AnimatePresence>

          {/* Forms */}
          <AnimatePresence mode="wait">
            {tab === "staff" ? (
              <motion.form
                key="staff"
                initial={reduce ? false : { opacity: 0, x: 16 }}
                animate={reduce ? undefined : { opacity: 1, x: 0 }}
                exit={reduce ? undefined : { opacity: 0, x: -16 }}
                transition={{ duration: 0.3, ease: EASE }}
                onSubmit={handleStaffLogin}
                className="mt-6 space-y-4"
              >
                <Field label="Email or phone">
                  <input
                    type="text" required autoComplete="username"
                    value={email} onChange={(e) => setEmail(e.target.value)}
                    placeholder="you@renzo.dev"
                    className="auth-input"
                  />
                </Field>
                <Field label="Password">
                  <div className="relative">
                    <input
                      type={showPass ? "text" : "password"} required autoComplete="current-password"
                      value={password} onChange={(e) => setPassword(e.target.value)}
                      placeholder="••••••••"
                      className="auth-input pr-10"
                    />
                    <button type="button" onClick={() => setShowPass((v) => !v)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-stone-500 hover:text-stone-300 transition-colors">
                      {showPass ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
                    </button>
                  </div>
                </Field>
                <SubmitButton loading={loading} label="Sign in" />
              </motion.form>
            ) : (
              <div key="customer">
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
                      <Field label="Mobile number">
                        <input
                          type="tel" required
                          value={phone} onChange={(e) => setPhone(e.target.value)}
                          placeholder="9990001111"
                          className="auth-input"
                        />
                      </Field>
                      <SubmitButton loading={loading} label="Send code" />
                      <p className="text-center text-xs text-stone-500">
                        New here?{" "}
                        <Link href="/signup" className="text-gold hover:underline">Create account</Link>
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
                      <Field label="Enter 6-digit code">
                        <input
                          inputMode="numeric" maxLength={6} required
                          value={otp} onChange={(e) => setOtp(e.target.value.replace(/\D/g, ""))}
                          placeholder="123456"
                          className="auth-input text-center font-mono text-xl tracking-[0.5em]"
                        />
                      </Field>
                      {devOtp && (
                        <p className="text-center text-xs text-stone-500">
                          Dev code: <span className="font-mono font-semibold text-gold">{devOtp}</span>
                        </p>
                      )}
                      <SubmitButton loading={loading} label="Verify &amp; sign in" />
                      <button type="button" onClick={() => { setOtpStep("phone"); setOtp(""); setError(null); }}
                        className="w-full text-center text-xs text-stone-500 hover:text-stone-300 transition-colors">
                        ← Use a different number
                      </button>
                    </motion.form>
                  )}
                </AnimatePresence>

                {/* Customers only — staff/admin keep password sign-in. */}
                {GOOGLE_ENABLED && otpStep === "phone" && (
                  <div className="mt-6 space-y-4">
                    <div className="flex items-center gap-3">
                      <span className="h-px flex-1 bg-white/10" />
                      <span className="text-[10px] font-semibold uppercase tracking-widest text-stone-600">or</span>
                      <span className="h-px flex-1 bg-white/10" />
                    </div>
                    <GoogleLoginButton
                      loading={googleLoading}
                      onCredential={handleGoogleCredential}
                    />
                  </div>
                )}
              </div>
            )}
          </AnimatePresence>

          {/* Debug log */}
          <AnimatePresence>
            {debug.length > 0 && (
              <motion.div
                initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }} exit={{ opacity: 0, height: 0 }}
                className="mt-5 overflow-hidden rounded-xl border border-white/10 bg-stone-900/60 p-3"
              >
                <p className="mb-1 text-[10px] font-semibold uppercase tracking-widest text-stone-500">Auth log</p>
                {debug.map((line, i) => (
                  <p key={i} className="font-mono text-[11px] text-stone-400">{line}</p>
                ))}
              </motion.div>
            )}
          </AnimatePresence>

          <div className="mt-8 space-y-3 text-center">
            <p className="text-xs text-stone-600">
              New customer?{" "}
              <Link href="/signup" className="text-gold hover:underline">Create your account →</Link>
            </p>
            <p className="text-xs text-stone-700">
              <Link href="/" className="hover:text-stone-500 transition-colors">← Back to home</Link>
              {" · "}
              <Link href="/book" className="hover:text-stone-500 transition-colors">Book without an account</Link>
            </p>
          </div>
        </motion.div>
      </div>

      <style>{`
        .auth-input {
          width: 100%;
          background: rgb(28 25 23 / 0.8);
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
      `}</style>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block space-y-1.5">
      <span className="text-xs font-medium text-stone-400">{label}</span>
      {children}
    </label>
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
      {loading ? "Please wait…" : <span dangerouslySetInnerHTML={{ __html: label }} />}
      {!loading && <ArrowRight className="size-4" />}
    </motion.button>
  );
}
