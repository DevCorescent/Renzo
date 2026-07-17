import Link from "next/link";
import { ShieldAlert } from "lucide-react";

export const metadata = {
  title: "Unauthorized — Renzo",
  description: "You do not have permission to view this page.",
};

export default function UnauthorizedPage() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center bg-stone-950 px-4 text-stone-100">
      <div className="w-full max-w-md rounded-2xl border border-white/8 bg-stone-900 p-8 text-center">
        <span className="mx-auto flex size-14 items-center justify-center rounded-2xl bg-amber-500/10 text-amber-400 ring-1 ring-amber-500/20">
          <ShieldAlert className="size-7" />
        </span>
        <h1 className="mt-5 text-2xl font-bold tracking-tight">Access denied</h1>
        <p className="mt-2 text-sm leading-relaxed text-stone-400">
          You don&apos;t have permission to view this page. Sign in with an authorized account, or
          return to the Renzo home page.
        </p>
        <div className="mt-8 flex flex-col gap-3 sm:flex-row sm:justify-center">
          <Link
            href="/login"
            className="rounded-full bg-amber-500 px-6 py-2.5 text-sm font-bold text-stone-950 transition hover:bg-amber-400"
          >
            Sign in
          </Link>
          <Link
            href="/"
            className="rounded-full border border-white/10 px-6 py-2.5 text-sm font-medium text-stone-300 transition hover:border-white/20 hover:text-stone-100"
          >
            Go home
          </Link>
        </div>
      </div>
    </main>
  );
}
