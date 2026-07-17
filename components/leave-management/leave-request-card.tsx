"use client";

// OWNER: Gauransh
// MODULE: Super Admin Leave Management

import * as React from "react";
import { CalendarRange, Clock } from "lucide-react";
import { Badge } from "@/components/shared/ui";
import { WorkerAvatar } from "@/components/workers/worker-ui";
import { STATUS_TONE, formatDate, workerName, workerBranchName, type BranchLeave, type LeaveStatus } from "@/components/branch-leaves/types";

// One professional leave-request card. Every value shown is a real column selected
// by GET /api/v1/admin/leaves — nothing invented (no "department"/"approval stage",
// which the Leave/Worker schema does not carry). `status` is passed in so the parent
// can show an optimistic value the instant an approval lands.
export function LeaveRequestCard({
  leave,
  status,
  onOpen,
}: {
  leave: BranchLeave;
  status: LeaveStatus;
  onOpen: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onOpen}
      className="flex w-full flex-col gap-3 rounded-lg border border-gray-200 bg-white p-4 text-left transition hover:border-gray-300 hover:bg-gray-50/50 focus:outline-none focus:ring-2 focus:ring-gray-900/10"
    >
      <div className="flex items-start justify-between gap-3">
        <div className="flex min-w-0 items-center gap-3">
          <WorkerAvatar
            firstName={leave.worker.firstName}
            lastName={leave.worker.lastName}
            photo={leave.worker.profilePhoto}
            id={leave.worker.id}
            size={40}
          />
          <div className="min-w-0">
            <p className="truncate text-sm font-medium text-gray-900">{workerName(leave.worker)}</p>
            <p className="truncate text-[11px] text-gray-500">
              <span className="font-mono">{leave.worker.employeeCode}</span>
              {leave.worker.designation?.name ? ` · ${leave.worker.designation.name}` : ""}
            </p>
          </div>
        </div>
        <Badge tone={STATUS_TONE[status]}>{status}</Badge>
      </div>

      <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-gray-600">
        <span className="inline-flex items-center gap-1 font-medium text-gray-800">
          {leave.leaveType.name}
          <span className="text-[10px] text-gray-400">({leave.leaveType.code})</span>
        </span>
        <span className="inline-flex items-center gap-1">
          <CalendarRange className="size-3.5 text-gray-400" aria-hidden="true" />
          {formatDate(leave.startDate)} → {formatDate(leave.endDate)}
        </span>
        <span className="text-gray-500">{leave.days} {leave.days === 1 ? "day" : "days"}</span>
        <span className="text-gray-400">{workerBranchName(leave.worker)}</span>
      </div>

      {leave.reason && <p className="line-clamp-2 text-xs text-gray-500">{leave.reason}</p>}

      <div className="flex items-center gap-1 text-[11px] text-gray-400">
        <Clock className="size-3" aria-hidden="true" /> Applied {formatDate(leave.createdAt)}
      </div>
    </button>
  );
}
