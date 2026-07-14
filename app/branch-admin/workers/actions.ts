"use server";

// ============================================================================
// OWNER  : Gauransh
// MODULE : Branch Admin — Worker mutations
//
// Server Actions, not a client data library. React 19's useActionState gives the
// pending / error / success states a form needs, so React Hook Form and a query
// cache would both be dependencies earning nothing here.
//
// Every action goes through the HTTP API — never Prisma. That is what keeps
// requireAuth(), the branch-isolation guard and the route's own validation as the
// single source of truth. This file re-implements none of it.
//
// BRANCH ASSIGNMENT IS NEVER SENT. POST /api/v1/admin/workers takes the branch
// from the caller's JWT for a BRANCH_ADMIN and ignores any branchId in the body.
// A branch admin therefore cannot create a worker in another branch, and the UI
// does not have to be trusted to prevent it.
// ============================================================================

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { apiPost, apiPatch, apiDelete } from "@/lib/api-server";
import type { FormState } from "@/lib/form-state";

// FormState and IDLE_FORM_STATE live in lib/form-state.ts. A "use server" module
// may export ONLY async functions — every export becomes a callable server
// endpoint — so a plain object cannot ship from here.

const WORKERS_PATH = "/branch-admin/workers";

/** Trimmed value, or undefined — an empty input must not be sent as "". */
function field(data: FormData, key: string): string | undefined {
  const value = data.get(key);
  if (typeof value !== "string") return undefined;
  return value.trim() || undefined;
}

/** Comma-separated free text → string[]. Matches the API's `languages`/`certificates`. */
function list(data: FormData, key: string): string[] | undefined {
  const raw = field(data, key);
  if (!raw) return undefined;

  return raw
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
}

// ============================================================================
// CREATE — POST /api/v1/admin/workers
// ============================================================================

export async function createWorkerAction(
  _prev: FormState,
  data: FormData
): Promise<FormState> {
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
    // branchId is deliberately absent. See the module header.
  };

  // The client schema already refused an obviously bad payload, but it is a
  // convenience, not a gate — a tampered request reaches here regardless. The
  // route re-validates everything and its field errors are what get rendered.
  const result = await apiPost<{ id: string }>("/api/v1/admin/workers", payload);

  if (!result.ok) {
    return {
      status: "error",
      // The route's own message — not a second copy of the rules restated here.
      message: result.message,
      errors: result.errors ?? {},
    };
  }

  // Drops the cached list so the new worker is present the moment we land on it.
  revalidatePath(WORKERS_PATH);

  // redirect() works by throwing, so it must be the last statement and must sit
  // outside any try/catch — a swallowed NEXT_REDIRECT would silently strand the
  // user on the form after a successful create.
  //
  // The name rides along in the query string: it is what the list page turns into
  // the success toast. There is no toast library in this project, and adding one
  // to carry a single string would be a poor trade.
  const created = [field(data, "firstName"), field(data, "lastName")]
    .filter(Boolean)
    .join(" ");

  redirect(`${WORKERS_PATH}?created=${encodeURIComponent(created)}`);
}

// ============================================================================
// DEACTIVATE — DELETE /api/v1/admin/workers/[id]
//
// A soft delete: the route deactivates the profile AND the login account, and
// purges the worker's sessions in one transaction. There is no hard delete, and
// the UI must not imply one.
// ============================================================================

export async function deactivateWorkerAction(
  _prev: FormState,
  data: FormData
): Promise<FormState> {
  const id = field(data, "id");
  if (!id) {
    return { status: "error", message: "Worker id is required", errors: {} };
  }

  const result = await apiDelete(`/api/v1/admin/workers/${id}`);

  if (!result.ok) {
    return { status: "error", message: result.message, errors: result.errors ?? {} };
  }

  revalidatePath(WORKERS_PATH);

  return { status: "success", message: "Worker deactivated", errors: {} };
}

// ============================================================================
// REACTIVATE — PATCH /api/v1/admin/workers/[id] { isActive: true }
//
// Deliberately NOT the inverse of DELETE. DELETE also disables the User row and
// revokes sessions; PATCH only flips WorkerProfile.isActive. Reactivating here
// restores the profile — the login account stays disabled until an admin resets
// it, which is the safer default and matches what the backend actually does.
// ============================================================================

export async function reactivateWorkerAction(
  _prev: FormState,
  data: FormData
): Promise<FormState> {
  const id = field(data, "id");
  if (!id) {
    return { status: "error", message: "Worker id is required", errors: {} };
  }

  const result = await apiPatch(`/api/v1/admin/workers/${id}`, { isActive: true });

  if (!result.ok) {
    return { status: "error", message: result.message, errors: result.errors ?? {} };
  }

  revalidatePath(WORKERS_PATH);

  return { status: "success", message: "Worker reactivated", errors: {} };
}
