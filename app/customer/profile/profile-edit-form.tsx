"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Pencil, X, Check, Loader2 } from "lucide-react";
import { API } from "@/lib/endpoints";

interface Initial {
  firstName:   string;
  lastName:    string;
  gender:      string;
  dateOfBirth: string;
  anniversary: string;
}

export function ProfileEditForm({ initial }: { initial: Initial }) {
  const router = useRouter();
  const [editing, setEditing] = useState(false);
  const [form, setForm] = useState(initial);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function set(key: keyof Initial, value: string) {
    setForm((prev) => ({ ...prev, [key]: value }));
  }

  async function save() {
    setSaving(true);
    setError(null);
    try {
      const res = await fetch(API.customer.profile, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          firstName:   form.firstName,
          lastName:    form.lastName || null,
          gender:      form.gender || null,
          dateOfBirth: form.dateOfBirth || null,
          anniversary: form.anniversary || null,
        }),
      });
      const json = await res.json();
      if (!res.ok) {
        setError(json.message ?? "Failed to save");
        return;
      }
      setEditing(false);
      router.refresh();
    } catch {
      setError("Network error");
    } finally {
      setSaving(false);
    }
  }

  function cancel() {
    setForm(initial);
    setError(null);
    setEditing(false);
  }

  return (
    <div className="rounded-xl border border-white/8 bg-stone-900">
      <div className="flex items-center justify-between border-b border-white/8 px-4 py-3">
        <h2 className="text-sm font-semibold text-stone-200">Personal Information</h2>
        {!editing ? (
          <button
            onClick={() => setEditing(true)}
            className="flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-medium text-stone-400 transition hover:bg-white/5 hover:text-stone-200"
          >
            <Pencil className="size-3.5" /> Edit
          </button>
        ) : (
          <div className="flex items-center gap-2">
            <button
              onClick={cancel}
              disabled={saving}
              className="flex items-center gap-1 rounded-lg px-3 py-1.5 text-xs text-stone-400 transition hover:bg-white/5 hover:text-stone-200 disabled:opacity-40"
            >
              <X className="size-3.5" /> Cancel
            </button>
            <button
              onClick={save}
              disabled={saving}
              className="flex items-center gap-1 rounded-lg bg-amber-500 px-3 py-1.5 text-xs font-bold text-stone-950 transition hover:bg-amber-400 disabled:opacity-60"
            >
              {saving ? <Loader2 className="size-3.5 animate-spin" /> : <Check className="size-3.5" />}
              Save
            </button>
          </div>
        )}
      </div>

      <div className="p-4">
        {error && (
          <p className="mb-3 rounded-lg border border-red-500/20 bg-red-500/10 px-3 py-2 text-xs text-red-400">{error}</p>
        )}

        {editing ? (
          <div className="grid gap-3 sm:grid-cols-2">
            <Field label="First Name" required>
              <input
                value={form.firstName}
                onChange={(e) => set("firstName", e.target.value)}
                className="w-full rounded-lg border border-white/10 bg-stone-800 px-3 py-2 text-sm text-stone-100 outline-none focus:border-amber-500/50"
              />
            </Field>
            <Field label="Last Name">
              <input
                value={form.lastName}
                onChange={(e) => set("lastName", e.target.value)}
                className="w-full rounded-lg border border-white/10 bg-stone-800 px-3 py-2 text-sm text-stone-100 outline-none focus:border-amber-500/50"
              />
            </Field>
            <Field label="Gender">
              <select
                value={form.gender}
                onChange={(e) => set("gender", e.target.value)}
                className="w-full rounded-lg border border-white/10 bg-stone-800 px-3 py-2 text-sm text-stone-100 outline-none focus:border-amber-500/50"
              >
                <option value="">— Select —</option>
                <option value="MALE">Male</option>
                <option value="FEMALE">Female</option>
                <option value="UNISEX">Other / Prefer not to say</option>
              </select>
            </Field>
            <Field label="Date of Birth">
              <input
                type="date"
                value={form.dateOfBirth}
                onChange={(e) => set("dateOfBirth", e.target.value)}
                className="w-full rounded-lg border border-white/10 bg-stone-800 px-3 py-2 text-sm text-stone-100 outline-none focus:border-amber-500/50"
              />
            </Field>
            <Field label="Anniversary">
              <input
                type="date"
                value={form.anniversary}
                onChange={(e) => set("anniversary", e.target.value)}
                className="w-full rounded-lg border border-white/10 bg-stone-800 px-3 py-2 text-sm text-stone-100 outline-none focus:border-amber-500/50"
              />
            </Field>
          </div>
        ) : (
          <dl className="grid gap-3 sm:grid-cols-2">
            {([
              ["First Name",    form.firstName || "—"],
              ["Last Name",     form.lastName  || "—"],
              ["Gender",        form.gender    || "—"],
              ["Date of Birth", form.dateOfBirth ? new Date(form.dateOfBirth).toLocaleDateString("en-IN") : "—"],
              ["Anniversary",   form.anniversary ? new Date(form.anniversary).toLocaleDateString("en-IN") : "—"],
            ] as [string, string][]).map(([label, value]) => (
              <div key={label} className="rounded-lg border border-white/8 bg-stone-800/50 p-3">
                <dt className="text-[11px] font-medium uppercase tracking-wide text-stone-500">{label}</dt>
                <dd className="mt-1 text-sm text-stone-200">{value}</dd>
              </div>
            ))}
          </dl>
        )}
      </div>
    </div>
  );
}

function Field({ label, required, children }: { label: string; required?: boolean; children: React.ReactNode }) {
  return (
    <div>
      <label className="mb-1.5 block text-[11px] font-medium uppercase tracking-wide text-stone-500">
        {label}{required && <span className="ml-0.5 text-amber-500">*</span>}
      </label>
      {children}
    </div>
  );
}
