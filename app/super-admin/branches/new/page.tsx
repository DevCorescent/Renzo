"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { API } from "@/lib/endpoints";

// OWNER: Hemant | MODULE: Create Branch

export default function NewBranchPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setLoading(true);
    setError(null);

    const fd = new FormData(e.currentTarget);
    const body = Object.fromEntries(fd.entries());

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
        <p className="rounded border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-600">
          {error}
        </p>
      )}

      <form onSubmit={handleSubmit} className="max-w-lg space-y-4 rounded border border-gray-200 bg-white p-5">
        <Row label="Branch Name" name="name" required placeholder="Renzo Bandra" />
        <Row label="Slug" name="slug" required placeholder="bandra" hint="URL identifier — lowercase, no spaces" />
        <Row label="Code" name="code" required placeholder="BAN" hint="Short unique code (2–5 chars)" />
        <Row label="Address" name="address" required placeholder="Shop 12, Hill Road" />
        <Row label="City" name="city" required placeholder="Mumbai" />
        <Row label="State" name="state" required placeholder="Maharashtra" />
        <Row label="Pincode" name="pincode" required placeholder="400050" />
        <Row label="Phone" name="phone" required placeholder="+91 98765 43210" />
        <Row label="Email" name="email" type="email" placeholder="bandra@renzo.com" />
        <Row label="WhatsApp" name="whatsapp" placeholder="+91 98765 43210" />
        <Row label="Map URL" name="mapUrl" placeholder="https://maps.google.com/..." />

        <div className="flex gap-3 pt-2">
          <button
            type="submit"
            disabled={loading}
            className="rounded bg-gray-900 px-4 py-2 text-sm font-medium text-white hover:bg-gray-700 disabled:opacity-50"
          >
            {loading ? "Creating…" : "Create Branch"}
          </button>
          <button
            type="button"
            onClick={() => router.back()}
            className="rounded border border-gray-300 px-4 py-2 text-sm font-medium text-gray-600 hover:bg-gray-50"
          >
            Cancel
          </button>
        </div>
      </form>
    </div>
  );
}

function Row({
  label, name, required, placeholder, hint, type = "text",
}: {
  label: string; name: string; required?: boolean;
  placeholder?: string; hint?: string; type?: string;
}) {
  return (
    <label className="block space-y-1">
      <span className="text-xs font-medium text-gray-600">
        {label} {required && <span className="text-red-500">*</span>}
      </span>
      <input
        name={name}
        type={type}
        required={required}
        placeholder={placeholder}
        className="w-full rounded border border-gray-200 px-3 py-2 text-sm outline-none focus:border-gray-400"
      />
      {hint && <p className="text-[11px] text-gray-400">{hint}</p>}
    </label>
  );
}
