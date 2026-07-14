"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Star, Loader2, Check } from "lucide-react";
import { API } from "@/lib/endpoints";
import type { ApiResponse } from "@/types/api";

// OWNER: Aman | MODULE: Reviews — Rate your stylist
// Shown on a COMPLETED booking. Creates a review (POST) the first time and
// edits it (PATCH) afterwards — the server is the one that enforces
// "completed only / your booking / one per booking", this is just the form.

export type ExistingReview = {
  id: string;
  overallRating: number;
  workerRating: number | null;
  comment: string | null;
  status: string;
};

export function ReviewDialog({
  appointmentId,
  stylistName,
  existing,
}: {
  appointmentId: string;
  stylistName: string | null;
  existing: ExistingReview | null;
}) {
  const router = useRouter();

  const [open, setOpen] = React.useState(false);
  const [rating, setRating] = React.useState(existing?.overallRating ?? 0);
  const [hover, setHover] = React.useState(0);
  const [comment, setComment] = React.useState(existing?.comment ?? "");
  const [loading, setLoading] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [done, setDone] = React.useState(false);

  const isEdit = existing !== null;

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (rating < 1) {
      setError("Please choose a star rating");
      return;
    }
    setLoading(true);
    setError(null);

    try {
      const payload = {
        appointmentId,
        overallRating: rating,
        // The stylist is who this review is really about.
        workerRating: rating,
        comment: comment.trim() || undefined,
      };

      const res = await fetch(
        isEdit ? API.customer.review(existing.id) : API.customer.reviews,
        {
          method: isEdit ? "PATCH" : "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        }
      );
      const json: ApiResponse<unknown> = await res.json();
      if (!json.success) throw new Error(json.message || "Could not submit review");

      setDone(true);
      setOpen(false);
      router.refresh(); // pull the saved review back through the server component
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not submit review");
    } finally {
      setLoading(false);
    }
  }

  if (!open) {
    return (
      <div className="space-y-2">
        {existing && (
          <div className="flex items-center gap-2">
            <StarRow value={existing.overallRating} />
            <span className="text-xs text-stone-500">
              {existing.status === "APPROVED" ? "Published" : "Pending moderation"}
            </span>
          </div>
        )}
        {existing?.comment && (
          <p className="text-sm text-stone-400">&ldquo;{existing.comment}&rdquo;</p>
        )}
        {done && !existing && (
          <p className="flex items-center gap-1.5 text-xs text-emerald-400">
            <Check className="size-3.5" /> Review submitted — pending moderation
          </p>
        )}
        <button
          onClick={() => setOpen(true)}
          className="rounded-full bg-amber-500 px-4 py-2 text-xs font-bold text-stone-950 transition hover:bg-amber-400 active:scale-95"
        >
          {isEdit ? "Edit review" : "Rate stylist"}
        </button>
      </div>
    );
  }

  return (
    <form onSubmit={submit} className="space-y-3">
      <p className="text-sm text-stone-300">
        {stylistName ? `How was your service with ${stylistName}?` : "How was your service?"}
      </p>

      {/* Stars */}
      <div className="flex items-center gap-1" role="radiogroup" aria-label="Overall rating">
        {[1, 2, 3, 4, 5].map((n) => (
          <button
            key={n}
            type="button"
            role="radio"
            aria-checked={rating === n}
            aria-label={`${n} star${n === 1 ? "" : "s"}`}
            onClick={() => setRating(n)}
            onMouseEnter={() => setHover(n)}
            onMouseLeave={() => setHover(0)}
            className="transition hover:scale-110"
          >
            <Star
              className={`size-7 ${
                n <= (hover || rating)
                  ? "fill-amber-400 text-amber-400"
                  : "text-stone-700"
              }`}
            />
          </button>
        ))}
      </div>

      <textarea
        value={comment}
        onChange={(e) => setComment(e.target.value)}
        rows={3}
        maxLength={1000}
        placeholder="Tell others about your experience (optional)"
        className="w-full resize-none rounded-xl border border-white/8 bg-stone-950 px-3 py-2 text-sm text-stone-200 placeholder:text-stone-600 focus:border-amber-500/40 focus:outline-none"
      />

      {error && (
        <p className="rounded-xl border border-red-500/20 bg-red-500/10 px-3 py-2 text-xs text-red-400">
          {error}
        </p>
      )}

      <div className="flex gap-2">
        <button
          type="submit"
          disabled={loading}
          className="flex items-center gap-1.5 rounded-full bg-amber-500 px-4 py-2 text-xs font-bold text-stone-950 transition hover:bg-amber-400 disabled:opacity-60"
        >
          {loading && <Loader2 className="size-3.5 animate-spin" />}
          {loading ? "Submitting…" : isEdit ? "Save changes" : "Submit review"}
        </button>
        <button
          type="button"
          onClick={() => { setOpen(false); setError(null); }}
          className="rounded-full px-4 py-2 text-xs font-medium text-stone-500 transition hover:text-stone-300"
        >
          Cancel
        </button>
      </div>

      {isEdit && (
        <p className="text-[11px] text-stone-600">
          Edited reviews are re-checked by our team before they appear publicly.
        </p>
      )}
    </form>
  );
}

function StarRow({ value }: { value: number }) {
  return (
    <span className="inline-flex items-center gap-0.5">
      {[1, 2, 3, 4, 5].map((i) => (
        <Star
          key={i}
          className={`size-4 ${i <= value ? "fill-amber-400 text-amber-400" : "text-stone-700"}`}
        />
      ))}
    </span>
  );
}
