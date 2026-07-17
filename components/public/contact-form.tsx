"use client";

import { useState, type FormEvent } from "react";
import { Loader2, CheckCircle2 } from "lucide-react";
import { API } from "@/lib/endpoints";
import type { ApiResponse } from "@/types/api";

function Field({
  id,
  label,
  type = "text",
  placeholder,
  required = true,
  as = "input",
  rows,
}: {
  id: string;
  label: string;
  type?: string;
  placeholder: string;
  required?: boolean;
  as?: "input" | "textarea";
  rows?: number;
}) {
  const className =
    "w-full rounded-xl border border-white/15 bg-white/5 px-4 py-2.5 text-sm text-white outline-none transition placeholder:text-stone-500 focus:border-amber-500/50";

  return (
    <div>
      <label htmlFor={id} className="mb-1.5 block text-xs font-medium text-stone-300">
        {label}
        {required && <span className="text-amber-400"> *</span>}
      </label>
      {as === "textarea" ? (
        <textarea id={id} name={id} required={required} rows={rows ?? 4} placeholder={placeholder} className={className} />
      ) : (
        <input id={id} name={id} type={type} required={required} placeholder={placeholder} className={className} />
      )}
    </div>
  );
}

export function ContactForm() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  async function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    setLoading(true);

    const fd = new FormData(e.currentTarget);
    const body = {
      name: String(fd.get("name") ?? "").trim(),
      email: String(fd.get("email") ?? "").trim(),
      phone: String(fd.get("phone") ?? "").trim() || undefined,
      subject: String(fd.get("subject") ?? "").trim() || undefined,
      message: String(fd.get("message") ?? "").trim(),
    };

    try {
      const res = await fetch(API.public.contact, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(body),
      });
      const json = (await res.json()) as ApiResponse;
      if (!res.ok || !json.success) {
        setError(json.message || "Something went wrong. Please try again.");
        return;
      }
      setDone(true);
      e.currentTarget.reset();
    } catch {
      setError("Could not reach the server. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  if (done) {
    return (
      <div className="rounded-2xl border border-emerald-500/20 bg-emerald-500/5 p-8 text-center">
        <CheckCircle2 className="mx-auto size-10 text-emerald-400" />
        <h3 className="mt-4 text-lg font-semibold text-stone-100">Message sent</h3>
        <p className="mt-2 text-sm text-stone-400">
          Thanks for reaching out — we&apos;ll get back to you soon.
        </p>
        <button
          type="button"
          onClick={() => setDone(false)}
          className="mt-6 text-sm text-amber-400 transition hover:text-amber-300"
        >
          Send another message
        </button>
      </div>
    );
  }

  return (
    <form onSubmit={onSubmit} className="space-y-5">
      <Field id="name" label="Name" placeholder="Your full name" />
      <Field id="email" label="Email" type="email" placeholder="you@email.com" />
      <Field id="phone" label="Phone" type="tel" placeholder="+91 …" required={false} />
      <Field id="subject" label="Subject" placeholder="How can we help?" required={false} />
      <Field
        id="message"
        label="Message"
        as="textarea"
        placeholder="Tell us a little more…"
        rows={5}
      />

      {error && (
        <p className="rounded-xl border border-red-500/20 bg-red-500/10 px-4 py-2.5 text-sm text-red-300">
          {error}
        </p>
      )}

      <button
        type="submit"
        disabled={loading}
        className="inline-flex w-full items-center justify-center gap-2 rounded-full bg-amber-500 py-3 text-sm font-bold text-stone-950 transition hover:bg-amber-400 disabled:opacity-60"
      >
        {loading && <Loader2 className="size-4 animate-spin" />}
        {loading ? "Sending…" : "Send message"}
      </button>
    </form>
  );
}
