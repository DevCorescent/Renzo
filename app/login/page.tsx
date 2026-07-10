"use client";

// OWNER: Devanshi | MODULE: Login Page (used by all user types)
// Basic working implementation — OTP login for customers, email+password for
// staff. Styling is intentionally plain; refine as needed.

import { useState } from "react";
import { useRouter } from "next/navigation";
import { API } from "@/lib/endpoints";
import { Button } from "@/components/ui/button";
import type { ApiResponse, UserType } from "@/types/api";

// Where each role lands after login. Must stay in step with the ROUTE_ROLES
// table in proxy.ts, or the user bounces straight to /unauthorized.
const HOME_FOR: Record<UserType, string> = {
  SUPER_ADMIN:        "/super-admin/dashboard",
  OWNER:              "/branch-admin/dashboard",   // branch owner → branch panel
  BRANCH_ADMIN:       "/branch-admin/dashboard",
  RECEPTIONIST:       "/reception/dashboard",
  WORKER:             "/worker/dashboard",
  CUSTOMER:           "/customer/dashboard",
  INVENTORY_MANAGER:  "/inventory/dashboard",
  MARKETING_MANAGER:  "/marketing/dashboard",
  ACCOUNTANT:         "/accountant/dashboard",
};

type LoggedInUser = { userType: UserType; name: string | null };

export default function LoginPage() {
  const router = useRouter();
  const [tab, setTab] = useState<"staff" | "customer">("staff");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [debug, setDebug] = useState<string[]>([]);

  // staff
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  // customer OTP
  const [phone, setPhone] = useState("");
  const [otp, setOtp] = useState("");
  const [otpSent, setOtpSent] = useState(false);
  const [devOtp, setDevOtp] = useState<string | null>(null);

  function goHome(user: LoggedInUser) {
    const dest = HOME_FOR[user.userType] ?? "/";
    console.log("[login] role:", user.userType, "→ navigating to:", dest);
    setDebug((d) => [...d, `✓ Logged in as ${user.userType} (${user.name ?? "—"}) → going to ${dest}`]);
    router.push(dest);
    router.refresh();
  }

  async function post<T>(url: string, body: unknown): Promise<ApiResponse<T>> {
    console.log("[login] POST", url, body);
    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    const data: ApiResponse<T> = await res.json();
    console.log("[login] response", res.status, data);
    return data;
  }

  async function handleStaffLogin(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    setDebug([]);
    try {
      setDebug((d) => [...d, `→ Calling ${API.auth.login}…`]);
      const json = await post<{ user: LoggedInUser }>(API.auth.login, { email, password });
      if (!json.success || !json.data) throw new Error(json.message);
      setDebug((d) => [...d, `✓ API success: role=${json.data!.user.userType}`]);
      goHome(json.data.user);
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Login failed";
      console.error("[login] error:", msg);
      setDebug((d) => [...d, `✗ Error: ${msg}`]);
      setError(msg);
    } finally {
      setLoading(false);
    }
  }

  async function handleSendOtp(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    try {
      const json = await post<{ devOtp?: string }>(API.auth.otpSend, { phone });
      if (!json.success) throw new Error(json.message);
      setOtpSent(true);
      // Dev convenience: the API returns the code outside production.
      setDevOtp(json.data?.devOtp ?? null);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not send OTP");
    } finally {
      setLoading(false);
    }
  }

  async function handleVerifyOtp(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    try {
      const json = await post<{ user: LoggedInUser }>(API.auth.otpVerify, { phone, otp });
      if (!json.success || !json.data) throw new Error(json.message);
      goHome(json.data.user);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Invalid OTP");
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="w-full max-w-sm border border-border bg-card p-8">
        <h1 className="font-heading text-2xl font-semibold">Sign in to Renzo</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          {tab === "staff" ? "Staff & admin access" : "Customers sign in with a one-time code"}
        </p>

        <div className="mt-6 flex border border-border">
          {(["staff", "customer"] as const).map((t) => (
            <button
              key={t}
              type="button"
              onClick={() => {
                setTab(t);
                setError(null);
              }}
              className={
                (tab === t
                  ? "bg-primary text-primary-foreground"
                  : "text-muted-foreground hover:bg-muted") +
                " flex-1 px-3 py-2 text-xs font-semibold uppercase tracking-wider"
              }
            >
              {t === "staff" ? "Staff" : "Customer"}
            </button>
          ))}
        </div>

        {error && (
          <p className="mt-4 border border-destructive/40 bg-destructive/10 px-3 py-2 text-sm text-destructive">
            {error}
          </p>
        )}

        {tab === "staff" ? (
          <form onSubmit={handleStaffLogin} className="mt-6 space-y-4">
            <Field label="Email">
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                autoComplete="username"
                className="w-full border border-border bg-background px-3 py-2 text-sm outline-none focus:border-primary"
              />
            </Field>
            <Field label="Password">
              <input
                type="password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                autoComplete="current-password"
                className="w-full border border-border bg-background px-3 py-2 text-sm outline-none focus:border-primary"
              />
            </Field>
            <Button type="submit" disabled={loading} className="w-full">
              {loading ? "Signing in…" : "Sign in"}
            </Button>
          </form>
        ) : !otpSent ? (
          <form onSubmit={handleSendOtp} className="mt-6 space-y-4">
            <Field label="Phone number">
              <input
                type="tel"
                required
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                placeholder="9990001111"
                className="w-full border border-border bg-background px-3 py-2 text-sm outline-none focus:border-primary"
              />
            </Field>
            <Button type="submit" disabled={loading} className="w-full">
              {loading ? "Sending…" : "Send code"}
            </Button>
          </form>
        ) : (
          <form onSubmit={handleVerifyOtp} className="mt-6 space-y-4">
            <Field label={`Code sent to ${phone}`}>
              <input
                inputMode="numeric"
                required
                value={otp}
                onChange={(e) => setOtp(e.target.value)}
                placeholder="123456"
                className="w-full border border-border bg-background px-3 py-2 text-center text-lg tracking-[0.4em] outline-none focus:border-primary"
              />
            </Field>
            {devOtp && (
              <p className="text-center text-xs text-muted-foreground">
                Dev code: <span className="font-mono font-semibold">{devOtp}</span>
              </p>
            )}
            <Button type="submit" disabled={loading} className="w-full">
              {loading ? "Verifying…" : "Verify & continue"}
            </Button>
            <button
              type="button"
              onClick={() => {
                setOtpSent(false);
                setOtp("");
                setDevOtp(null);
              }}
              className="w-full text-xs text-muted-foreground hover:underline"
            >
              Use a different number
            </button>
          </form>
        )}
        {debug.length > 0 && (
          <div className="mt-4 rounded border border-gray-200 bg-gray-50 p-3">
            <p className="mb-1 text-[10px] font-semibold uppercase tracking-wider text-gray-400">Auth log</p>
            {debug.map((line, i) => (
              <p key={i} className="font-mono text-[11px] text-gray-600">{line}</p>
            ))}
          </div>
        )}
      </div>
    </main>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block space-y-1.5">
      <span className="text-xs font-medium text-muted-foreground">{label}</span>
      {children}
    </label>
  );
}
