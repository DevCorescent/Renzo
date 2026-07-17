"use server";

import { revalidatePath } from "next/cache";
import { apiPatch, apiPost } from "@/lib/api-server";
import { API } from "@/lib/endpoints";
import type { FormState } from "@/lib/form-state";

const LEAVES_PATH = "/branch-admin/leaves";

export type LeaveActionStatus = "APPROVED" | "REJECTED" | "PENDING" | "CANCELLED";

export async function setLeaveStatusAction(
  id: string,
  status: LeaveActionStatus,
  rejectionReason?: string
): Promise<FormState> {
  if (!id) return { status: "error", message: "Leave id is required", errors: {} };

  const result = await apiPatch(API.admin.leave(id), {
    status,
    ...(rejectionReason ? { rejectionReason } : {}),
  });
  if (!result.ok) {
    return { status: "error", message: result.message, errors: result.errors ?? {} };
  }

  revalidatePath(LEAVES_PATH);
  const messages: Record<LeaveActionStatus, string> = {
    APPROVED: "Leave approved",
    REJECTED: "Leave rejected",
    PENDING: "Leave reopened",
    CANCELLED: "Leave cancelled",
  };
  return { status: "success", message: messages[status], errors: {} };
}

export async function grantLeaveAction(input: {
  workerId: string;
  leaveTypeId: string;
  startDate: string;
  endDate: string;
  reason: string;
}): Promise<FormState> {
  const result = await apiPost(API.admin.leaves, input);
  if (!result.ok) {
    return { status: "error", message: result.message, errors: result.errors ?? {} };
  }
  revalidatePath(LEAVES_PATH);
  return { status: "success", message: "Leave granted", errors: {} };
}
