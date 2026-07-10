"use client";

// Campaign table for the Marketing dashboard — thin client wrapper around DataTable.
import * as React from "react";
import { Megaphone, Send } from "lucide-react";
import { DataTable, type Column } from "./data-table";
import { StatusBadge, statusTone } from "./status-badge";

export type CampaignRow = {
  id: string;
  name: string;
  channel: string;
  recipients: number;
  sent: number;
  status: string;
};

export function CampaignTable({ rows }: { rows: CampaignRow[] }) {
  const columns = React.useMemo<Column<CampaignRow>[]>(
    () => [
      {
        key: "name",
        header: "Campaign",
        sortable: true,
        sortValue: (r) => r.name,
        cell: (r) => (
          <div className="flex items-center gap-3">
            <span className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-gray-100 text-gray-500 dark:bg-white/5 dark:text-(--sa-text-2)">
              <Megaphone className="size-4" />
            </span>
            <p className="truncate font-medium text-gray-900 dark:text-(--sa-text)">{r.name}</p>
          </div>
        ),
      },
      {
        key: "channel",
        header: "Channel",
        sortable: true,
        sortValue: (r) => r.channel,
        cell: (r) => <span className="text-gray-600 dark:text-(--sa-text-2)">{r.channel}</span>,
      },
      {
        key: "recipients",
        header: "Recipients",
        align: "right",
        sortable: true,
        sortValue: (r) => r.recipients,
        cell: (r) => <span className="tabular-nums text-gray-700 dark:text-(--sa-text-2)">{r.recipients.toLocaleString("en-IN")}</span>,
      },
      {
        key: "sent",
        header: "Sent",
        align: "right",
        sortable: true,
        sortValue: (r) => r.sent,
        cell: (r) => (
          <span className="inline-flex items-center gap-1.5 tabular-nums text-gray-700 dark:text-(--sa-text-2)">
            <Send className="size-3.5 text-gray-400 dark:text-(--sa-muted)" />
            {r.sent.toLocaleString("en-IN")}
          </span>
        ),
      },
      {
        key: "status",
        header: "Status",
        align: "right",
        sortable: true,
        sortValue: (r) => r.status,
        cell: (r) => <StatusBadge tone={statusTone(r.status)}>{r.status.replace(/_/g, " ")}</StatusBadge>,
      },
    ],
    []
  );

  return (
    <DataTable
      columns={columns}
      rows={rows}
      getRowKey={(r) => r.id}
      searchPlaceholder="Search campaigns…"
      initialSort={{ key: "status", dir: "asc" }}
      pageSize={8}
      empty={{ title: "No campaigns yet", description: "Marketing campaigns will appear here." }}
    />
  );
}
