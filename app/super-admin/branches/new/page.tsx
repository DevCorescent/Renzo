"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { API } from "@/lib/endpoints";
import { ImageUpload } from "@/components/shared/image-upload";
import {
  INDIA_STATES,
  citiesForState,
  pincodeForCity,
} from "@/lib/india-locations";

// OWNER: Hemant | MODULE: Create Branch
// Two-column layout — identity/branding on the left, location + contact on the
// right — so the form fills the width instead of a narrow single column.
// State → City are cascading dropdowns; picking a city auto-fills a representative
// pincode (still editable, since a city spans many pincodes).

function toSlug(v: string) {
  return v
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

export default function NewBranchPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Controlled fields that drive each other (name→slug, state→city→pincode) or
  // come from non-native inputs (cover upload).
  const [name, setName] = useState("");
  const [slug, setSlug] = useState("");
  const [slugTouched, setSlugTouched] = useState(false);
  const [state, setState] = useState("");
  const [city, setCity] = useState("");
  const [pincode, setPincode] = useState("");
  const [coverImage, setCoverImage] = useState<string | null>(null);

  const cities = useMemo(() => citiesForState(state), [state]);

  function onNameChange(v: string) {
    setName(v);
    if (!slugTouched) setSlug(toSlug(v));
  }

  function onStateChange(v: string) {
    setState(v);
    setCity("");
    setPincode("");
  }

  function onCityChange(v: string) {
    setCity(v);
    const pin = pincodeForCity(state, v);
    if (pin) setPincode(pin);
  }

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setLoading(true);
    setError(null);

    const fd = new FormData(e.currentTarget);
    const body = {
      ...Object.fromEntries(fd.entries()),
      // Controlled values win over anything the native form captured.
      name,
      slug,
      state,
      city,
      pincode,
      coverImage: coverImage ?? undefined,
    };

    try {
      const res = await fetch(API.admin.branches, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const json = await res.json();
      if (!json.success) throw new Error(json.message);
      router.push("/super-admin/branches");
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to create branch");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-semibold text-gray-900">New Branch</h1>
        <p className="mt-0.5 text-sm text-gray-500">Create a new saloon location</p>
      </div>

      {error && (
        <p className="max-w-3xl rounded border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-600">
          {error}
        </p>
      )}

      <form onSubmit={handleSubmit} className="space-y-6">
        <div className="grid gap-6 lg:grid-cols-2">
          {/* ── Identity & branding ─────────────────────────────────────── */}
          <section className="space-y-4 rounded-lg border border-gray-200 bg-white p-5">
            <h2 className="text-sm font-semibold text-gray-800">Identity</h2>

            <Field label="Branch Name" required>
              <input
                value={name}
                onChange={(e) => onNameChange(e.target.value)}
                required
                placeholder="Renzo Bandra"
                className={inputCls}
              />
            </Field>

            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Slug" required hint="URL identifier — lowercase, no spaces">
                <input
                  value={slug}
                  onChange={(e) => {
                    setSlugTouched(true);
                    setSlug(toSlug(e.target.value));
                  }}
                  required
                  placeholder="bandra"
                  className={inputCls}
                />
              </Field>
              <Field label="Code" required hint="Short unique code (2–5 chars)">
                <input name="code" required placeholder="BAN" className={inputCls} />
              </Field>
            </div>

            <Field label="Description">
              <textarea
                name="description"
                rows={3}
                placeholder="A short blurb shown on the public branch page…"
                className={inputCls}
              />
            </Field>

            <div>
              <p className="mb-1.5 text-xs font-medium text-gray-600">Cover photo</p>
              <ImageUpload value={coverImage} onChange={setCoverImage} label="" />
            </div>
          </section>

          {/* ── Location & contact ──────────────────────────────────────── */}
          <section className="space-y-4 rounded-lg border border-gray-200 bg-white p-5">
            <h2 className="text-sm font-semibold text-gray-800">Location</h2>

            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="State" required>
                <select
                  value={state}
                  onChange={(e) => onStateChange(e.target.value)}
                  required
                  className={inputCls}
                >
                  <option value="">Select state…</option>
                  {INDIA_STATES.map((s) => (
                    <option key={s} value={s}>
                      {s}
                    </option>
                  ))}
                </select>
              </Field>

              <Field label="City" required>
                <select
                  value={city}
                  onChange={(e) => onCityChange(e.target.value)}
                  required
                  disabled={!state}
                  className={`${inputCls} disabled:bg-gray-50 disabled:text-gray-400`}
                >
                  <option value="">
                    {state ? "Select city…" : "Pick a state first"}
                  </option>
                  {cities.map((c) => (
                    <option key={c.name} value={c.name}>
                      {c.name}
                    </option>
                  ))}
                </select>
              </Field>
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Pincode" required hint="Auto-filled from city — edit if needed">
                <input
                  value={pincode}
                  onChange={(e) => setPincode(e.target.value.replace(/\D/g, "").slice(0, 6))}
                  required
                  inputMode="numeric"
                  placeholder="400050"
                  className={inputCls}
                />
              </Field>
              <Field label="Address" required>
                <input name="address" required placeholder="Shop 12, Hill Road" className={inputCls} />
              </Field>
            </div>

            <h2 className="pt-2 text-sm font-semibold text-gray-800">Contact</h2>

            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Phone" required>
                <input name="phone" required placeholder="+91 98765 43210" className={inputCls} />
              </Field>
              <Field label="Email">
                <input name="email" type="email" placeholder="bandra@renzo.com" className={inputCls} />
              </Field>
              <Field label="WhatsApp">
                <input name="whatsapp" placeholder="+91 98765 43210" className={inputCls} />
              </Field>
              <Field label="Map URL">
                <input name="mapUrl" placeholder="https://maps.google.com/..." className={inputCls} />
              </Field>
            </div>
          </section>
        </div>

        <div className="flex gap-3">
          <button
            type="submit"
            disabled={loading}
            className="rounded bg-gray-900 px-5 py-2 text-sm font-medium text-white hover:bg-gray-700 disabled:opacity-50"
          >
            {loading ? "Creating…" : "Create Branch"}
          </button>
          <button
            type="button"
            onClick={() => router.back()}
            className="rounded border border-gray-300 px-5 py-2 text-sm font-medium text-gray-600 hover:bg-gray-50"
          >
            Cancel
          </button>
        </div>
      </form>
    </div>
  );
}

const inputCls =
  "w-full rounded border border-gray-200 px-3 py-2 text-sm outline-none focus:border-gray-400";

function Field({
  label,
  required,
  hint,
  children,
}: {
  label: string;
  required?: boolean;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <label className="block space-y-1">
      <span className="text-xs font-medium text-gray-600">
        {label} {required && <span className="text-red-500">*</span>}
      </span>
      {children}
      {hint && <p className="text-[11px] text-gray-400">{hint}</p>}
    </label>
  );
}
