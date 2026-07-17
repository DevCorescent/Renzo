"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { motion, AnimatePresence, useReducedMotion } from "framer-motion";
import { Scissors, Eye, EyeOff, ArrowRight, Loader2 } from "lucide-react";
import { API } from "@/lib/endpoints";
import { HOME_FOR, isStaffRole } from "@/lib/auth-paths";
import { AuthInputStyles } from "@/components/auth/auth-input-styles";
import type { ApiResponse, UserType } from "@/types/api";

const EASE = [0.22, 1, 0.36, 1] as const;

type LoggedInUser = { userType: UserType; name: string | null };

export default function StaffLoginPage() {
  const router = useRouter();
  const reduce = useReducedMotion();

  const [showPass, setShowPass] = React.useState(false);
  const [loading, setLoading] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [email, setEmail] = React.useState("");
  const [password, setPassword] = React.useState("");

  async function handleStaffLogin(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(API.auth.login, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password, portal: "staff" }),
      });
      const json: ApiResponse<{ user: LoggedInUser }> = await res.json();
      if (!json.success || !json.data) throw new Error(json.message);

      const user = json.data.user;
      if (!isStaffRole(user.userType)) {
        throw new Error("This portal is for staff and admins only");
      }

      router.push(HOME_FOR[user.userType] ?? "/");
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Login failed");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="relative flex min-h-screen overflow-hidden bg-stone-950 text-stone-100">
      <div
        aria-hidden
        className="pointer-events-none absolute -top-40 right-[-10%] size-[36rem] rounded-full bg-white/5 blur-3xl"
      />

      <div className="relative flex flex-1 flex-col items-center justify-center px-4 py-12 sm:px-8">
        <Link href="/" className="mb-10 flex items-center gap-2">
          <span className="inline-flex size-8 items-center justify-center rounded-full bg-white/10 text-stone-200 ring-1 ring-white/20">
            <Scissors className="size-4" />
          </span>
          <span className="font-heading text-xl font-bold text-white">Renzo</span>
        </Link>

        <motion.div
          initial={reduce ? false : { opacity: 0, y: 24 }}
          animate={reduce ? undefined : { opacity: 1, y: 0 }}
          transition={{ duration: 0.6, ease: EASE }}
          className="w-full max-w-md rounded-3xl border border-white/10 bg-stone-900/70 p-6 sm:p-8"
        >
          <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-stone-500">
            Staff portal
          </p>
          <h1 className="mt-2 font-heading text-2xl font-bold text-white">
            Admin &amp; worker sign in
          </h1>
          <p className="mt-1 text-sm text-stone-400">
            Password access for branch teams and platform admins.
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

          <form onSubmit={handleStaffLogin} className="mt-6 space-y-4">
            <label className="block space-y-1.5">
              <span className="text-xs font-medium text-stone-400">
                Email or phone
              </span>
              <input
                type="text"
                required
                autoComplete="username"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@renzo.dev"
                className="auth-input"
              />
            </label>
            <label className="block space-y-1.5">
              <span className="text-xs font-medium text-stone-400">Password</span>
              <div className="relative">
                <input
                  type={showPass ? "text" : "password"}
                  required
                  autoComplete="current-password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  className="auth-input pr-10"
                />
                <button
                  type="button"
                  onClick={() => setShowPass((v) => !v)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-stone-500 transition-colors hover:text-stone-300"
                >
                  {showPass ? (
                    <EyeOff className="size-4" />
                  ) : (
                    <Eye className="size-4" />
                  )}
                </button>
              </div>
            </label>

            <motion.button
              type="submit"
              disabled={loading}
              whileHover={{ scale: 1.01 }}
              whileTap={{ scale: 0.98 }}
              className="flex w-full items-center justify-center gap-2 rounded-full bg-[#F5F2EB] py-2.5 text-sm font-semibold text-stone-900 transition-colors hover:bg-[#EDE8DF] disabled:opacity-60"
            >
              {loading ? <Loader2 className="size-4 animate-spin" /> : null}
              {loading ? "Please wait…" : "Sign in"}
              {!loading && <ArrowRight className="size-4" />}
            </motion.button>
          </form>
        </motion.div>
      </div>

      <AuthInputStyles />
    </div>
  );
}
