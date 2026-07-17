"use client";

// OWNER: Gauransh
// MODULE: Marketing — Campaign detail drawer
// PURPOSE: Show a campaign's Information + Analytics + Participation + Timeline.
//          Basic fields come from the row; participation + the delivery log timeline
//          are fetched from GET /admin/campaigns/[id] on open.

import * as React from "react";
import { X, ArrowUpFromLine } from "lucide-react";
import { Badge } from "@/components/shared/ui";
import { API } from "@/lib/endpoints";
import {
  STATUS_TONE, formatDate, formatDateTime,
  type ApiEnvelope, type CampaignDetail, type CampaignLogRow, type CampaignRow,
} from "./types";

export function CampaignDetailDrawer({ campaign, onClose }: { campaign: CampaignRow | null; onClose: () => void }) {
  const dialogRef = React.useRef<HTMLDialogElement>(null);
  const open = campaign !== null;
  const campaignId = campaign?.id ?? null;

  const [logs, setLogs] = React.useState<CampaignLogRow[]>([]);
  const [participation, setParticipation] = React.useState<number | null>(null);
  const [loading, setLoading] = React.useState(false);

  React.useEffect(() => {
    const el = dialogRef.current;
    if (!el) return;
    if (open && !el.open) el.showModal();
    else if (!open && el.open) el.close();
  }, [open]);

  React.useEffect(() => {
    if (!open || !campaignId) return;
    let cancelled = false;
    void (async () => {
      setLoading(true);
      setLogs([]);
      setParticipation(null);
      try {
        const res = await fetch(API.admin.campaign(campaignId));
        const json = (await res.json()) as ApiEnvelope<CampaignDetail>;
        if (!cancelled && res.ok && json.success && json.data) {
          setLogs(json.data.logs ?? []);
          setParticipation(json.data.participation ?? 0);
        }
      } catch {
        /* timeline stays empty on a transient failure */
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [open, campaignId]);

  return (
    <dialog
      ref={dialogRef}
      onCancel={(e) => { e.preventDefault(); onClose(); }}
      onClick={(e) => { if (e.target === dialogRef.current) onClose(); }}
      aria-labelledby="campaign-detail-title"
      className="ml-auto h-dvh w-[calc(100vw-2rem)] max-w-lg rounded-none border-l border-gray-200 bg-white p-0 shadow-xl backdrop:bg-gray-900/40"
    >
      {campaign && (
        <div className="flex h-dvh flex-col">
          <div className="flex items-start justify-between border-b border-gray-100 px-5 py-4">
            <div className="min-w-0">
              <h2 id="campaign-detail-title" className="flex items-center gap-2 text-sm font-semibold text-gray-900">
                {campaign.name} <Badge tone={STATUS_TONE[campaign.status]}>{campaign.status}</Badge>
              </h2>
              <p className="mt-0.5 text-xs text-gray-500">{campaign.channel} · {campaign.branchName ?? "All branches"}</p>
            </div>
            <button type="button" onClick={onClose} aria-label="Close" className="rounded p-1 text-gray-400 transition hover:bg-gray-100 hover:text-gray-700 focus:outline-none focus:ring-2 focus:ring-gray-900/10"><X className="size-4" /></button>
          </div>

          <div className="flex-1 overflow-auto">
            <Section title="Campaign information">
              <dl className="grid grid-cols-2 gap-x-4 gap-y-2 text-xs sm:grid-cols-3">
                <Detail label="Channel" value={campaign.channel} />
                <Detail label="Branch" value={campaign.branchName ?? "All branches"} />
                <Detail label="Created by" value={campaign.createdByName ?? "—"} />
                <Detail label="Scheduled" value={formatDateTime(campaign.scheduledAt)} />
                <Detail label="Sent" value={formatDateTime(campaign.sentAt)} />
                <Detail label="Created" value={formatDate(campaign.createdAt)} />
              </dl>
              {campaign.description && <p className="mt-3 text-xs text-gray-600">{campaign.description}</p>}
            </Section>

            <Section title="Analytics">
              <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                <Stat label="Recipients" value={String(campaign.recipientCount)} />
                <Stat label="Sent" value={String(campaign.sentCount)} />
                <Stat label="Failed" value={String(campaign.failedCount)} />
                <Stat label="Opened" value={String(campaign.openCount)} />
              </div>
            </Section>

            <Section title="Customer participation">
              <p className="text-sm text-gray-800"><span className="font-semibold">{loading && participation === null ? "—" : (participation ?? campaign.participation)}</span> customers participated</p>
            </Section>

            <div className="px-5 py-4">
              <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-gray-400">Timeline</h3>
              {loading ? (
                <p className="py-6 text-center text-xs text-gray-400">Loading…</p>
              ) : logs.length === 0 ? (
                <p className="py-6 text-center text-xs text-gray-400">No delivery activity yet.</p>
              ) : (
                <ol className="space-y-2">
                  {logs.map((l) => (
                    <li key={l.id} className="flex items-start gap-2.5 rounded border border-gray-100 px-3 py-2">
                      <ArrowUpFromLine className="mt-0.5 size-3.5 text-gray-400" aria-hidden="true" />
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center justify-between gap-2">
                          <span className="text-xs font-medium text-gray-800">{l.status}</span>
                          <span className="text-[11px] text-gray-400">{l.channel}</span>
                        </div>
                        <p className="mt-0.5 text-[11px] text-gray-400">{formatDateTime(l.sentAt)}</p>
                      </div>
                    </li>
                  ))}
                </ol>
              )}
            </div>
          </div>
        </div>
      )}
    </dialog>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return <div className="border-b border-gray-100 px-5 py-4"><h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-gray-400">{title}</h3>{children}</div>;
}
function Detail({ label, value }: { label: string; value: string }) {
  return <div><dt className="text-gray-400">{label}</dt><dd className="mt-0.5 font-medium text-gray-800">{value}</dd></div>;
}
function Stat({ label, value }: { label: string; value: string }) {
  return <div className="rounded border border-gray-100 p-3"><p className="text-[11px] font-medium uppercase tracking-wide text-gray-400">{label}</p><p className="mt-1 text-sm font-semibold text-gray-900">{value}</p></div>;
}
