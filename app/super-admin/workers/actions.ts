"use server";

// ============================================================================
// MODULE : Super Admin — Worker mutations
//
// Mirrors branch-admin/workers/actions.ts but includes branchId in the payload.
// SUPER_ADMIN/OWNER must supply the target branch explicitly — the API resolves
// the branch from the JWT for BRANCH_ADMIN only.
// ============================================================================

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { apiPost } from "@/lib/api-server";
import type { FormState } from "@/lib/form-state";

const WORKERS_PATH = "/super-admin/workers";

function field(data: FormData, key: string): string | undefined {
  const value = data.get(key);
  if (typeof value !== "string") return undefined;
  return value.trim() || undefined;
}

function list(data: FormData, key: string): string[] | undefined {
  const raw = field(data, key);
  if (!raw) return undefined;
  return raw.split(",").map((s) => s.trim()).filter(Boolean);
}

export async function createWorkerSuperAdminAction(
  _prev: FormState,
  data: FormData
): Promise<FormState> {
  const branchId = field(data, "branchId");
  if (!branchId) {
    return { status: "error", message: "Please select a branch", errors: { branchId: ["Branch is required"] } };
  }

  const experienceRaw = field(data, "experience");

  const payload = {
    firstName: field(data, "firstName"),
    lastName: field(data, "lastName"),
    phone: field(data, "phone"),
    email: field(data, "email"),
    password: field(data, "password"),
    employeeCode: field(data, "employeeCode"),
    gender: field(data, "gender"),
    displayName: field(data, "displayName"),
    bio: field(data, "bio"),
    profilePhoto: field(data, "profilePhoto"),
    departmentId: field(data, "departmentId"),
    designationId: field(data, "designationId"),
    dateOfBirth: field(data, "dateOfBirth"),
    joinDate: field(data, "joinDate"),
    experience: experienceRaw !== undefined ? Number(experienceRaw) : undefined,
    languages: list(data, "languages"),
    certificates: list(data, "certificates"),
    isPublic: data.get("isPublic") === "on",
    branchId,
  };

  const result = await apiPost<{ id: string }>("/api/v1/admin/workers", payload);

  if (!result.ok) {
    return {
      status: "error",
      message: result.message,
      errors: result.errors ?? {},
    };
  }

  revalidatePath(WORKERS_PATH);

  const created = [field(data, "firstName"), field(data, "lastName")]
    .filter(Boolean)
    .join(" ");

  redirect(`${WORKERS_PATH}?created=${encodeURIComponent(created)}`);
}
