"use client";

// ============================================================================
// OWNER  : Gauransh
// MODULE : Worker Portfolio (UI) — gallery manager
//
// The one place a worker MANAGES their portfolio work: add, edit and remove
// before/after pieces, each in a category. It is the interactive companion to the
// read-only showcase — the gallery is the only portfolio content a worker can edit
// themselves (bio, skills and certificates have no worker-facing write endpoint),
// so this manages exactly that, through the existing POST/PATCH/DELETE routes.
//
// A completion meter sits on top: it is derived from real profile + gallery data
// (photo, bio, skills, languages, certificates, work) and never invents a field —
// it encourages a fuller portfolio without pretending cover photos or awards exist.
//
// NO REFETCH AFTER A WRITE. Create/edit/delete return authoritative results, so the
// in-memory list is mutated from them — instant, and the meter recomputes with it.
// ============================================================================

import * as React from "react";
import Image from "next/image";
import Link from "next/link";
import {
  Plus, Pencil, Trash2, Check, X, AlertTriangle, RefreshCw, Clock, ImageOff, ChevronLeft,
} from "lucide-react";
import { API } from "@/lib/endpoints";
import { Badge } from "@/components/shared/ui";
import { cn } from "@/lib/utils";
import { PortfolioItemModal } from "./portfolio-item-modal";
import type { GalleryItem, PortfolioSummary } from "./types";

type Envelope<T> = { success: boolean; message: string; data?: T };
type Paginated<T> = { items: T[]; total: number; page: number; limit: number; totalPages: number };

type Phase =
  | { kind: "loading" }
  | { kind: "error"; message: string }
  | { kind: "ready"; summary: PortfolioSummary; items: GalleryItem[] };

const EMPTY_ITEMS: GalleryItem[] = [];

export function PortfolioManager() {
  const [phase, setPhase] = React.useState<Phase>({ kind: "loading" });
  const [modalOpen, setModalOpen] = React.useState(false);
  const [editing, setEditing] = React.useState<GalleryItem | null>(null);
  const [busyId, setBusyId] = React.useState<string | null>(null);
  const [toast, setToast] = React.useState<string | null>(null);

  const load = React.useCallback(async (signal?: AbortSignal) => {
    try {
      const [summaryRes, galleryRes] = await Promise.all([
        fetch(API.worker.portfolioSummary, { signal }),
        fetch(`${API.worker.portfolio}?limit=100`, { signal }),
      ]);
      const summaryBody = (await summaryRes.json()) as Envelope<PortfolioSummary>;
      const galleryBody = (await galleryRes.json()) as Envelope<Paginated<GalleryItem>>;

      if (!summaryRes.ok || !summaryBody.success || !summaryBody.data) {
        setPhase({ kind: "error", message: summaryBody.message || "Could not load your portfolio" });
        return;
      }
      setPhase({
        kind: "ready",
        summary: summaryBody.data,
        items: galleryBody.success && galleryBody.data ? galleryBody.data.items : EMPTY_ITEMS,
      });
    } catch (e) {
      if ((e as Error)?.name === "AbortError") return;
      setPhase({ kind: "error", message: "Could not reach the server. Check your connection." });
    }
  }, []);

  React.useEffect(() => {
    const controller = new AbortController();
    void (async () => {
      await load(controller.signal);
    })();
    return () => controller.abort();
  }, [load]);

  React.useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(null), 4000);
    return () => clearTimeout(t);
  }, [toast]);

  function handleSaved(item: GalleryItem, mode: "create" | "edit") {
    setPhase((p) => {
      if (p.kind !== "ready") return p;
      const items =
        mode === "create"
          ? [item, ...p.items]
          : p.items.map((it) => (it.id === item.id ? item : it));
      return { ...p, items };
    });
    setModalOpen(false);
    setToast(mode === "create" ? "Work added — pending review." : "Work updated — pending review.");
  }

  async function handleDelete(item: GalleryItem) {
    if (busyId) return;
    if (!window.confirm(`Remove this ${item.category.toLowerCase()} work from your portfolio?`)) return;

    setBusyId(item.id);
    try {
      const res = await fetch(API.worker.portfolioItem(item.id), { method: "DELETE" });
      const body = (await res.json()) as Envelope<null>;
      if (!res.ok || !body.success) {
        setToast(body.message || "Could not remove this work.");
        return;
      }
      setPhase((p) =>
        p.kind === "ready" ? { ...p, items: p.items.filter((it) => it.id !== item.id) } : p
      );
      setToast("Work removed.");
    } catch {
      setToast("Could not reach the server. Please try again.");
    } finally {
      setBusyId(null);
    }
  }

  function openCreate() {
    setEditing(null);
    setModalOpen(true);
  }
  function openEdit(item: GalleryItem) {
    setEditing(item);
    setModalOpen(true);
  }

  return (
    <div className="mx-auto max-w-4xl space-y-6 pb-16">
      <Link
        href="/worker/portfolio"
        className="inline-flex items-center gap-1 text-xs text-gray-500 transition hover:text-gray-900"
      >
        <ChevronLeft className="size-3.5" aria-hidden="true" />
        Back to portfolio
      </Link>

      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-xl font-semibold text-gray-900">Manage portfolio</h1>
          <p className="mt-0.5 text-sm text-gray-500">Showcase your best before-and-after work.</p>
        </div>
        <button
          type="button"
          onClick={openCreate}
          className="inline-flex h-9 items-center gap-1.5 self-start rounded bg-gray-900 px-4 text-sm font-medium text-white transition hover:bg-gray-800 focus:outline-none focus:ring-2 focus:ring-gray-900/20 sm:self-auto"
        >
          <Plus className="size-4" aria-hidden="true" />
          Add work
        </button>
      </div>

      {toast && (
        <div
          role="status"
          aria-live="polite"
          className="flex items-center justify-between gap-3 rounded border border-gray-200 bg-white px-3 py-2 shadow-sm"
        >
          <p className="flex items-center gap-2 text-xs text-gray-700">
            <Check className="size-3.5 shrink-0 text-green-600" aria-hidden="true" />
            {toast}
          </p>
          <button
            type="button"
            onClick={() => setToast(null)}
            aria-label="Dismiss"
            className="rounded p-0.5 text-gray-400 transition hover:bg-gray-100 hover:text-gray-700 focus:outline-none focus:ring-2 focus:ring-gray-900/10"
          >
            <X className="size-3.5" />
          </button>
        </div>
      )}

      {phase.kind === "loading" && <ManagerSkeleton />}

      {phase.kind === "error" && (
        <div className="flex flex-col items-center justify-center rounded border border-red-100 bg-red-50/50 px-6 py-14 text-center">
          <AlertTriangle className="size-6 text-red-400" aria-hidden="true" />
          <h3 className="mt-3 text-sm font-semibold text-gray-900">Something went wrong</h3>
          <p className="mt-1 text-xs text-gray-500">{phase.message}</p>
          <button
            type="button"
            onClick={() => {
              setPhase({ kind: "loading" });
              load();
            }}
            className="mt-4 inline-flex h-9 items-center gap-1.5 rounded border border-gray-300 bg-white px-3 text-sm text-gray-700 transition hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-gray-900/10"
          >
            <RefreshCw className="size-3.5" aria-hidden="true" />
            Retry
          </button>
        </div>
      )}

      {phase.kind === "ready" && (
        <>
          <CompletionCard summary={phase.summary} workCount={phase.items.length} />

          {phase.items.length === 0 ? (
            <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-gray-200 bg-white px-6 py-16 text-center">
              <span className="flex size-12 items-center justify-center rounded-full bg-gray-50 text-gray-400 ring-1 ring-gray-200">
                <ImageOff className="size-6" aria-hidden="true" />
              </span>
              <h3 className="mt-4 text-sm font-semibold text-gray-900">No work added yet</h3>
              <p className="mt-1 max-w-sm text-xs text-gray-500">
                Add your best before-and-after pieces so customers can see what you do.
              </p>
              <button
                type="button"
                onClick={openCreate}
                className="mt-5 inline-flex h-9 items-center gap-1.5 rounded bg-gray-900 px-4 text-sm font-medium text-white transition hover:bg-gray-800 focus:outline-none focus:ring-2 focus:ring-gray-900/20"
              >
                <Plus className="size-4" aria-hidden="true" />
                Add work
              </button>
            </div>
          ) : (
            <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
              {phase.items.map((item) => (
                <div
                  key={item.id}
                  className="group overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-sm"
                >
                  <div className="relative aspect-[4/5] bg-gray-100">
                    <Image
                      src={item.afterImage}
                      alt={item.title ?? `${item.category} work`}
                      fill
                      sizes="(max-width: 640px) 50vw, (max-width: 1024px) 33vw, 25vw"
                      className="object-cover"
                    />
                    {item.beforeImage && (
                      <span className="absolute left-2 top-2 rounded-full bg-black/55 px-2 py-0.5 text-[10px] font-medium text-white backdrop-blur">
                        Before / After
                      </span>
                    )}
                    <span
                      className={cn(
                        "absolute right-2 top-2 inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-medium backdrop-blur",
                        item.isApproved ? "bg-green-600/90 text-white" : "bg-amber-500/90 text-white"
                      )}
                    >
                      {item.isApproved ? "Approved" : <><Clock className="size-2.5" aria-hidden="true" /> Pending</>}
                    </span>
                  </div>

                  <div className="flex items-center justify-between gap-2 p-2.5">
                    <div className="min-w-0">
                      <p className="truncate text-xs font-medium text-gray-800">
                        {item.title ?? "Untitled"}
                      </p>
                      <Badge tone="neutral">{item.category}</Badge>
                    </div>
                    <div className="flex shrink-0 items-center gap-0.5">
                      <button
                        type="button"
                        onClick={() => openEdit(item)}
                        aria-label="Edit work"
                        className="rounded p-1.5 text-gray-400 transition hover:bg-gray-100 hover:text-gray-700 focus:outline-none focus:ring-2 focus:ring-gray-900/10"
                      >
                        <Pencil className="size-3.5" />
                      </button>
                      <button
                        type="button"
                        onClick={() => handleDelete(item)}
                        disabled={busyId === item.id}
                        aria-label="Remove work"
                        className="rounded p-1.5 text-gray-400 transition hover:bg-red-50 hover:text-red-600 focus:outline-none focus:ring-2 focus:ring-red-500/10 disabled:opacity-50"
                      >
                        <Trash2 className="size-3.5" />
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </>
      )}

      <PortfolioItemModal
        open={modalOpen}
        editing={editing}
        onClose={() => setModalOpen(false)}
        onSaved={handleSaved}
      />
    </div>
  );
}

/* ─── Completion meter ────────────────────────────────────────────────────────
 * Derived only from fields that actually exist. Each item is a real, fillable part
 * of the portfolio; a fuller bar means a stronger professional identity.
 */
function CompletionCard({ summary, workCount }: { summary: PortfolioSummary; workCount: number }) {
  const checklist = [
    { label: "Display photo", done: Boolean(summary.profilePhoto) },
    { label: "Professional bio", done: Boolean(summary.bio?.trim()) },
    { label: "Skills", done: summary.specializations.length > 0 },
    { label: "Languages", done: summary.languages.length > 0 },
    { label: "Certificates", done: summary.certificates.length > 0 },
    { label: "Portfolio work", done: workCount > 0 },
  ];
  const done = checklist.filter((c) => c.done).length;
  const pct = Math.round((done / checklist.length) * 100);
  const missing = checklist.filter((c) => !c.done);

  return (
    <div className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm">
      <div className="flex items-center justify-between">
        <p className="text-sm font-semibold text-gray-900">Portfolio completion</p>
        <span className="text-lg font-semibold text-gray-900">{pct}%</span>
      </div>
      <div className="mt-3 h-2 overflow-hidden rounded-full bg-gray-100">
        <div className="h-full rounded-full bg-gray-900 transition-[width]" style={{ width: `${pct}%` }} />
      </div>
      {missing.length > 0 ? (
        <div className="mt-4">
          <p className="text-xs text-gray-500">To strengthen your portfolio, add:</p>
          <div className="mt-2 flex flex-wrap gap-1.5">
            {missing.map((m) => (
              <span
                key={m.label}
                className="rounded-full bg-gray-50 px-2.5 py-1 text-[11px] font-medium text-gray-600 ring-1 ring-inset ring-gray-200"
              >
                {m.label}
              </span>
            ))}
          </div>
        </div>
      ) : (
        <p className="mt-4 text-xs text-green-700">Your portfolio is complete. Keep your work fresh.</p>
      )}
    </div>
  );
}

function ManagerSkeleton() {
  return (
    <div className="space-y-6" aria-hidden="true">
      <div className="h-28 animate-pulse rounded-2xl bg-gray-100" />
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
        {Array.from({ length: 8 }).map((_, i) => (
          <div key={i} className="aspect-[4/5] animate-pulse rounded-2xl bg-gray-100" />
        ))}
      </div>
    </div>
  );
}
