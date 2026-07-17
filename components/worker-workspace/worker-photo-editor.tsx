"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { ImageUpload } from "@/components/shared/image-upload";
import { API } from "@/lib/endpoints";

export function WorkerPhotoEditor({
  workerId,
  currentPhoto,
}: {
  workerId: string;
  currentPhoto: string | null;
}) {
  const router = useRouter();
  const [photo, setPhoto] = React.useState<string | null>(currentPhoto);
  const [saving, setSaving] = React.useState(false);
  const [msg, setMsg] = React.useState<string | null>(null);

  async function save(url: string | null) {
    setPhoto(url);
    setSaving(true);
    setMsg(null);
    try {
      const res = await fetch(API.admin.worker(workerId), {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ profilePhoto: url }),
      });
      const json = await res.json();
      if (!res.ok || !json.success) {
        setMsg(json.message ?? "Could not save photo");
        return;
      }
      setMsg("Photo updated");
      router.refresh();
    } catch {
      setMsg("Network error");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="mt-3 max-w-xs space-y-1">
      <ImageUpload
        value={photo}
        onChange={(url) => void save(url)}
        label={saving ? "Saving…" : "Update profile photo"}
      />
      {msg && <p className="text-[11px] text-gray-500">{msg}</p>}
    </div>
  );
}
