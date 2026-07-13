"use client";

import * as React from "react";
import { ImageUpload } from "@/components/shared/image-upload";
import { API } from "@/lib/endpoints";
import { Loader2 } from "lucide-react";

export function BranchCoverUpload({ branchId, currentImage }: { branchId: string; currentImage: string | null }) {
  const [image, setImage] = React.useState<string | null>(currentImage);
  const [saving, setSaving] = React.useState(false);
  const [status, setStatus] = React.useState<"idle" | "saved" | "error">("idle");

  async function handleChange(url: string | null) {
    setImage(url);
    setSaving(true);
    setStatus("idle");
    try {
      const res = await fetch(API.admin.branch(branchId), {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ coverImage: url }),
      });
      if (!res.ok) throw new Error();
      setStatus("saved");
      setTimeout(() => setStatus("idle"), 2500);
    } catch {
      setStatus("error");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div>
      <ImageUpload value={image} onChange={handleChange} label="Cover photo" />
      <p className="mt-1 text-xs text-gray-400">
        {saving && <span className="flex items-center gap-1"><Loader2 className="size-3 animate-spin inline" /> Saving…</span>}
        {status === "saved" && <span className="text-emerald-600">Saved!</span>}
        {status === "error" && <span className="text-red-500">Failed to save</span>}
      </p>
    </div>
  );
}
