"use client";

import * as React from "react";
import Image from "next/image";
import { ImageUpload } from "@/components/shared/image-upload";
import { API } from "@/lib/endpoints";
import { Camera } from "lucide-react";

export function ServiceImageUpload({ serviceId, currentImage }: { serviceId: string; currentImage: string | null }) {
  const [image, setImage] = React.useState<string | null>(currentImage);
  const [open, setOpen] = React.useState(false);

  async function handleChange(url: string | null) {
    setImage(url);
    setOpen(false);
    await fetch(API.admin.service(serviceId), {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ image: url }),
    });
  }

  if (!open) {
    return (
      <button
        onClick={() => setOpen(true)}
        title="Set service image"
        className="group relative flex size-8 items-center justify-center overflow-hidden rounded border border-gray-200 bg-gray-50 transition hover:border-gray-300"
      >
        {image ? (
          <Image src={image} alt="" fill className="object-cover" sizes="32px" />
        ) : (
          <Camera className="size-3.5 text-gray-400 group-hover:text-gray-600" />
        )}
      </button>
    );
  }

  return (
    <div className="space-y-1">
      <ImageUpload value={image} onChange={handleChange} />
      <button onClick={() => setOpen(false)} className="text-xs text-gray-400 hover:text-gray-600">
        Cancel
      </button>
    </div>
  );
}
