// ============================================================================
// OWNER  : Gauransh
// MODULE : Server-side API client
//
// The ONLY way a Server Component or Server Action may reach data.
//
// WHY THIS EXISTS
// Pages must never touch Prisma. Every guard the backend enforces —
// requireAuth(), authorizeWorkerAccess(), branch isolation resolved from
// WorkerBranch, validation, the scheduling engine — lives behind the route
// handlers. A page that queried Prisma directly would be re-implementing (and
// eventually contradicting) all of it. So the UI speaks to its own API over
// HTTP, exactly as a mobile client would.
//
// The session cookie is forwarded verbatim, so the API sees the real caller and
// applies the real RBAC. The frontend therefore duplicates NO authorization logic
// of its own — a branch admin is scoped to their branch because the API says so,
// not because a page remembered to filter.
// ============================================================================

import { headers, cookies } from "next/headers";
import type { ApiResponse } from "@/types/api";

/**
 * Route handlers are absolute-URL-only when called from the server, so the origin
 * is rebuilt from the inbound request rather than hardcoded — this has to work
 * behind a proxy in production and on localhost in dev without a config flag.
 */
async function origin(): Promise<string> {
  const h = await headers();

  const host = h.get("x-forwarded-host") ?? h.get("host") ?? "localhost:3000";
  const proto = h.get("x-forwarded-proto") ?? (host.startsWith("localhost") ? "http" : "https");

  return `${proto}://${host}`;
}

async function authHeaders(): Promise<HeadersInit> {
  const jar = await cookies();

  return {
    // Forwarded so the API authenticates the real user. Without this every call
    // would be anonymous and every route would 401.
    cookie: jar.toString(),
    "content-type": "application/json",
  };
}

export type ApiResult<T> =
  | { ok: true; data: T; message: string }
  | { ok: false; status: number; message: string; errors?: Record<string, string[]> };

async function unwrap<T>(res: Response): Promise<ApiResult<T>> {
  let body: ApiResponse<T> | null = null;

  try {
    body = (await res.json()) as ApiResponse<T>;
  } catch {
    // A non-JSON body means the route crashed before the response helper ran.
    return { ok: false, status: res.status, message: "Unexpected server response" };
  }

  if (!res.ok || !body.success) {
    return {
      ok: false,
      status: res.status,
      message: body?.message ?? "Request failed",
      errors: body?.errors,
    };
  }

  return {
    ok: true,
    data: body.data as T,
    message: body.message,
  };
}

/**
 * THE CONTRACT: this never throws. Ever.
 *
 * fetch() REJECTS — it does not resolve with an error status — on a refused
 * connection, a DNS failure, an aborted socket or a malformed URL. An uncaught
 * rejection here propagates straight out of the calling Server Component, and
 * Next renders a 500 for the whole page. That is exactly how a page died because
 * an OPTIONAL lookup could not be reached.
 *
 * Every transport failure is therefore converted into an ApiResult the caller can
 * branch on, so no page can ever be taken down by a request it did not depend on.
 */
async function request<T>(path: string, init: RequestInit): Promise<ApiResult<T>> {
  let res: Response;

  try {
    res = await fetch(`${await origin()}${path}`, {
      ...init,
      headers: await authHeaders(),
      // `no-store`: a worker roster is operational data. A receptionist looking at
      // a page cached 90 seconds ago will assign a stylist who has just been
      // marked unavailable.
      cache: "no-store",
    });
  } catch (e) {
    return {
      ok: false,
      status: 0, // No HTTP status exists — the request never reached the server.
      message:
        e instanceof Error && e.message
          ? `Could not reach the server: ${e.message}`
          : "Could not reach the server",
    };
  }

  return unwrap<T>(res);
}

export async function apiGet<T>(path: string): Promise<ApiResult<T>> {
  return request<T>(path, { method: "GET" });
}

export async function apiPost<T>(path: string, body: unknown): Promise<ApiResult<T>> {
  return request<T>(path, { method: "POST", body: JSON.stringify(body) });
}

export async function apiPatch<T>(path: string, body: unknown): Promise<ApiResult<T>> {
  return request<T>(path, { method: "PATCH", body: JSON.stringify(body) });
}

export async function apiDelete<T>(path: string): Promise<ApiResult<T>> {
  return request<T>(path, { method: "DELETE" });
}

/* ─── Contracts ────────────────────────────────────────────────────────────── */
// Mirrors the `paginated()` helper the API returns. Not a duplicated DTO — this is
// the wire format, and there is nowhere else to state it.

export type Paginated<T> = {
  items: T[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
};

/**
 * Exactly the shape of the explicit `select` in GET /api/v1/admin/workers.
 * Nothing here is invented: if a field is absent from that select, it is absent
 * from this type, and the UI cannot render it.
 */
export type WorkerListItem = {
  id: string;
  employeeCode: string;
  firstName: string;
  lastName: string;
  displayName: string | null;
  profilePhoto: string | null;
  phone: string | null;
  email: string | null;
  gender: "MALE" | "FEMALE" | "UNISEX";
  experience: number;
  isActive: boolean;
  isPublic: boolean;
  joinDate: string;
  createdAt: string;
  department: { id: string; name: string } | null;
  designation: { id: string; name: string; level: number } | null;
  branches: {
    isPrimary: boolean;
    isActive: boolean;
    branch: { id: string; name: string; code: string };
  }[];
};
