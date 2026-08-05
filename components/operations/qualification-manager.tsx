"use client";

// ============================================================================
// MODULE : Worker qualification manager
//
// Fixes the one thing that reliably breaks a walk-in: a stylist qualified for no
// services, so naming them on a booking is refused — at the counter, with a
// customer waiting.
//
// Three one-click routes to the same end, all of which reduce to the EXISTING
// PUT /admin/workers/:id/services. That endpoint has replace-all semantics, so
// every action here reads the worker's current set first and sends the UNION:
// assigning a new skill must never silently erase the others.
//
//   • Assign selected services to selected stylists
//   • Copy one stylist's services onto others
//   • Assign every active service (the fastest unblock)
//
// The list comes from /admin/workers/readiness, so what shows as "blocked" is
// decided by the same rule the booking engine enforces — one definition, not two.
// ============================================================================

import * as React from "react";
import { useRouter } from "next/navigation";
import { Loader2, Check, Copy, Wand2, AlertTriangle, Users } from "lucide-react";
import { cn } from "@/lib/utils";
import { API } from "@/lib/endpoints";
import { Badge, Card, CardBody, CardHeader, CardTitle } from "@/components/shared/ui";
import type { WorkerReadiness } from "@/lib/worker-readiness";

export type ServiceOption = { id: string; name: string };

const btnPrimary =
  "inline-flex items-center gap-1.5 rounded bg-gray-900 px-3 py-2 text-xs font-medium text-white transition hover:bg-gray-800 disabled:opacity-50 dark:bg-white dark:text-gray-900 dark:hover:bg-white/90";
const btnGhost =
  "inline-flex items-center gap-1.5 rounded border border-gray-200 px-2.5 py-1.5 text-xs text-gray-600 transition hover:bg-gray-50 disabled:opacity-50 dark:border-(--sa-border) dark:text-(--sa-text-2) dark:hover:bg-white/5";
const inputCls =
  "h-9 w-full rounded border border-gray-200 bg-white px-2.5 text-sm text-gray-900 outline-none transition focus:border-gray-400 dark:border-(--sa-border) dark:bg-(--sa-surface) dark:text-(--sa-text) dark:focus:border-white/30";

/** One row from GET /admin/workers/:id/services. */
type WorkerServiceRow = { service?: { id?: string } };

export function QualificationManager({
  rows,
  services,
}: {
  rows: WorkerReadiness[];
  services: ServiceOption[];
}) {
  const router = useRouter();

  const [selectedWorkers, setSelectedWorkers] = React.useState<Set<string>>(new Set());
  const [selectedServices, setSelectedServices] = React.useState<Set<string>>(new Set());
  const [copyFrom, setCopyFrom] = React.useState("");
  const [filter, setFilter] = React.useState("");
  const [onlyBlocked, setOnlyBlocked] = React.useState(true);

  const [busy, setBusy] = React.useState(false);
  const [note, setNote] = React.useState<{ tone: "ok" | "err"; text: string } | null>(null);

  const visible = React.useMemo(() => {
    const needle = filter.trim().toLowerCase();
    return rows.filter((r) => {
      if (onlyBlocked && r.bookable) return false;
      if (!needle) return true;
      return (
        r.worker.name.toLowerCase().includes(needle) ||
        r.worker.employeeCode.toLowerCase().includes(needle)
      );
    });
  }, [rows, filter, onlyBlocked]);

  const toggle = (set: Set<string>, id: string) => {
    const next = new Set(set);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    return next;
  };

  /** The service ids a worker already holds — read so a write can union, not replace. */
  async function currentServices(workerId: string): Promise<string[]> {
    const res = await fetch(API.admin.workerServices(workerId));
    const json = await res.json().catch(() => null);
    if (!res.ok || !json?.success) {
      throw new Error(json?.message ?? "Could not read their current services");
    }
    // `data` is the WorkerService join rows; the service id is nested, and the
    // row's own `id` is the join id — sending that back would be refused as an
    // unknown service.
    return ((json.data ?? []) as WorkerServiceRow[])
      .map((row) => row.service?.id ?? "")
      .filter(Boolean);
  }

  async function writeServices(workerId: string, ids: string[]) {
    const res = await fetch(API.admin.workerServices(workerId), {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ serviceIds: ids }),
    });
    const json = await res.json().catch(() => null);
    if (!res.ok || !json?.success) {
      const fieldErrors = json?.errors
        ? Object.values(json.errors as Record<string, string[]>).flat().join(" · ")
        : "";
      throw new Error(fieldErrors || json?.message || "Update refused");
    }
  }

  /**
   * Apply one action across every selected stylist.
   *
   * Sequential on purpose: an admin fixing a handful of people gains nothing from
   * parallel writes, and a failure has to name the person it belongs to rather
   * than collapse into one opaque error.
   */
  async function run(label: string, resolveIds: (workerId: string) => Promise<string[]>) {
    if (busy || selectedWorkers.size === 0) return;

    setBusy(true);
    setNote(null);

    let changed = 0;
    let skipped = 0;
    const failures: string[] = [];

    for (const workerId of selectedWorkers) {
      const name = rows.find((r) => r.worker.id === workerId)?.worker.name ?? workerId;
      try {
        const ids = await resolveIds(workerId);
        if (ids.length === 0) {
          skipped++;
          continue;
        }
        await writeServices(workerId, ids);
        changed++;
      } catch (e) {
        failures.push(`${name}: ${e instanceof Error ? e.message : "failed"}`);
      }
    }

    setBusy(false);
    setSelectedWorkers(new Set());

    const tail = skipped > 0 ? `, ${skipped} skipped` : "";
    if (failures.length > 0) {
      setNote({
        tone: "err",
        text: `${label}: ${changed} updated${tail}, ${failures.length} failed — ${failures[0]}`,
      });
    } else {
      setNote({
        tone: "ok",
        text: `${label}: ${changed} stylist${changed === 1 ? "" : "s"} updated${tail}.`,
      });
    }

    // Re-runs the server component, so the badges reflect what was just written.
    router.refresh();
  }

  const assignSelected = () =>
    run("Assigned selected services", async (workerId) => {
      const existing = await currentServices(workerId);
      return [...new Set([...existing, ...selectedServices])];
    });

  // No read needed: the union of anything with the whole catalogue IS the whole
  // catalogue, so this cannot lose an assignment.
  const assignAll = () => run("Assigned every service", async () => services.map((s) => s.id));

  const copyFromWorker = () =>
    run("Copied services", async (workerId) => {
      // Copying onto yourself is a no-op, not an error.
      if (workerId === copyFrom) return [];
      const [source, existing] = await Promise.all([
        currentServices(copyFrom),
        currentServices(workerId),
      ]);
      return [...new Set([...existing, ...source])];
    });

  const blockedCount = rows.filter((r) => !r.bookable).length;
  const allShownSelected =
    visible.length > 0 && visible.every((r) => selectedWorkers.has(r.worker.id));

  return (
    <div className="space-y-4">
      {blockedCount > 0 ? (
        <p className="flex items-center gap-2 rounded border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-900 dark:border-amber-500/25 dark:bg-amber-500/10 dark:text-amber-300">
          <AlertTriangle className="size-4 shrink-0" aria-hidden="true" />
          {blockedCount} stylist{blockedCount === 1 ? "" : "s"} cannot be booked. Reception meets
          this at the counter unless it is fixed here.
        </p>
      ) : (
        <p className="flex items-center gap-2 rounded border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-800 dark:border-emerald-500/25 dark:bg-emerald-500/10 dark:text-emerald-300">
          <Check className="size-4 shrink-0" aria-hidden="true" />
          Every stylist is bookable.
        </p>
      )}

      {note && (
        <p
          className={cn(
            "rounded border px-3 py-2 text-xs",
            note.tone === "ok"
              ? "border-green-100 bg-green-50 text-green-700 dark:border-emerald-500/20 dark:bg-emerald-500/10 dark:text-emerald-300"
              : "border-red-100 bg-red-50 text-red-700 dark:border-red-500/20 dark:bg-red-500/10 dark:text-red-300"
          )}
        >
          {note.text}
        </p>
      )}

      <div className="grid gap-4 lg:grid-cols-[1.5fr_360px]">
        {/* ── Stylists ────────────────────────────────────────────────────── */}
        <Card>
          <CardHeader className="flex flex-wrap items-center justify-between gap-2">
            <CardTitle className="flex items-center gap-2">
              <Users className="size-4 text-gray-400" aria-hidden="true" />
              Stylists
            </CardTitle>
            <span className="flex items-center gap-2">
              <input
                value={filter}
                onChange={(e) => setFilter(e.target.value)}
                placeholder="Filter…"
                aria-label="Filter stylists"
                className={cn(inputCls, "h-8 w-36")}
              />
              <label className="flex items-center gap-1.5 text-xs text-gray-500 dark:text-(--sa-text-2)">
                <input
                  type="checkbox"
                  checked={onlyBlocked}
                  onChange={(e) => setOnlyBlocked(e.target.checked)}
                  className="size-3.5 rounded border-gray-300"
                />
                Blocked only
              </label>
            </span>
          </CardHeader>
          <CardBody>
            {visible.length === 0 ? (
              <p className="py-8 text-center text-xs text-gray-400 dark:text-(--sa-muted)">
                {onlyBlocked
                  ? "Nothing blocked — every stylist is bookable."
                  : "No stylists match that filter."}
              </p>
            ) : (
              <>
                <button
                  type="button"
                  onClick={() =>
                    setSelectedWorkers(
                      allShownSelected ? new Set() : new Set(visible.map((r) => r.worker.id))
                    )
                  }
                  className={cn(btnGhost, "mb-2")}
                >
                  {allShownSelected ? "Clear selection" : "Select all shown"}
                </button>

                <ul className="divide-y divide-gray-100 dark:divide-white/5">
                  {visible.map((r) => (
                    <li key={r.worker.id} className="flex items-center gap-3 py-2">
                      <input
                        type="checkbox"
                        checked={selectedWorkers.has(r.worker.id)}
                        onChange={() => setSelectedWorkers((p) => toggle(p, r.worker.id))}
                        aria-label={`Select ${r.worker.name}`}
                        className="size-3.5 shrink-0 rounded border-gray-300"
                      />
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-sm text-gray-900 dark:text-(--sa-text)">
                          {r.worker.name}
                        </span>
                        <span className="block font-mono text-[11px] text-gray-400 dark:text-(--sa-muted)">
                          {r.worker.employeeCode} · {r.worker.serviceCount} service
                          {r.worker.serviceCount === 1 ? "" : "s"}
                        </span>
                      </span>
                      <span className="flex shrink-0 flex-wrap justify-end gap-1">
                        {r.issues.length === 0 ? (
                          <Badge tone="success">Ready</Badge>
                        ) : (
                          r.issues.map((i) => (
                            <span key={i.key} title={i.detail}>
                              <Badge tone={i.severity === "BLOCKER" ? "danger" : "warning"}>
                                {i.label}
                              </Badge>
                            </span>
                          ))
                        )}
                      </span>
                    </li>
                  ))}
                </ul>
              </>
            )}
          </CardBody>
        </Card>

        {/* ── Actions ─────────────────────────────────────────────────────── */}
        <Card className="h-fit lg:sticky lg:top-4">
          <CardHeader>
            <CardTitle>Assign qualifications</CardTitle>
          </CardHeader>
          <CardBody className="space-y-4">
            <p className="text-xs text-gray-500 dark:text-(--sa-text-2)">
              {selectedWorkers.size} stylist{selectedWorkers.size === 1 ? "" : "s"} selected.
              Assigning ADDS to what they already have — nothing is removed.
            </p>

            <div>
              <p className="mb-1 text-xs font-medium text-gray-600 dark:text-(--sa-text-2)">
                Pick services
              </p>
              <div className="max-h-44 overflow-y-auto rounded border border-gray-200 p-2 dark:border-(--sa-border)">
                {services.length === 0 ? (
                  <p className="py-2 text-center text-[11px] text-gray-400 dark:text-(--sa-muted)">
                    No active services in the catalogue.
                  </p>
                ) : (
                  services.map((s) => (
                    <label
                      key={s.id}
                      className="flex items-center gap-2 py-1 text-xs text-gray-600 dark:text-(--sa-text-2)"
                    >
                      <input
                        type="checkbox"
                        checked={selectedServices.has(s.id)}
                        onChange={() => setSelectedServices((p) => toggle(p, s.id))}
                        className="size-3.5 shrink-0 rounded border-gray-300"
                      />
                      {s.name}
                    </label>
                  ))
                )}
              </div>
              <button
                type="button"
                onClick={() => void assignSelected()}
                disabled={busy || selectedWorkers.size === 0 || selectedServices.size === 0}
                className={cn(btnPrimary, "mt-2 w-full justify-center")}
              >
                {busy ? (
                  <Loader2 className="size-3.5 animate-spin" aria-hidden="true" />
                ) : (
                  <Check className="size-3.5" aria-hidden="true" />
                )}
                Assign {selectedServices.size || ""} selected
              </button>
            </div>

            <div className="border-t border-gray-100 pt-3 dark:border-(--sa-border)">
              <label
                className="mb-1 block text-xs font-medium text-gray-600 dark:text-(--sa-text-2)"
                htmlFor="copy-from"
              >
                Copy from another stylist
              </label>
              <select
                id="copy-from"
                value={copyFrom}
                onChange={(e) => setCopyFrom(e.target.value)}
                className={inputCls}
              >
                <option value="">Choose a stylist…</option>
                {rows
                  .filter((r) => r.worker.serviceCount > 0)
                  .map((r) => (
                    <option key={r.worker.id} value={r.worker.id}>
                      {r.worker.name} ({r.worker.serviceCount})
                    </option>
                  ))}
              </select>
              <button
                type="button"
                onClick={() => void copyFromWorker()}
                disabled={busy || selectedWorkers.size === 0 || !copyFrom}
                className={cn(btnGhost, "mt-2 w-full justify-center")}
              >
                <Copy className="size-3.5" aria-hidden="true" /> Copy their services
              </button>
            </div>

            <div className="border-t border-gray-100 pt-3 dark:border-(--sa-border)">
              <p className="mb-1 text-xs font-medium text-gray-600 dark:text-(--sa-text-2)">
                Fastest fix
              </p>
              <button
                type="button"
                onClick={() => void assignAll()}
                disabled={busy || selectedWorkers.size === 0 || services.length === 0}
                className={cn(btnGhost, "w-full justify-center")}
              >
                <Wand2 className="size-3.5" aria-hidden="true" />
                Assign all {services.length} services
              </button>
              <p className="mt-1 text-[11px] text-gray-400 dark:text-(--sa-muted)">
                Makes them bookable immediately. Narrow it down afterwards from their profile.
              </p>
            </div>
          </CardBody>
        </Card>
      </div>
    </div>
  );
}
