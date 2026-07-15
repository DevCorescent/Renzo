// ============================================================================
// OWNER  : Gauransh
// MODULE : Leave Types (admin) — shared types & helpers
//
// Shapes mirror the LeaveType model exactly — id, name, code, isPaid, maxPerYear,
// isActive. The model carries NO createdAt and NO description, so neither appears
// here; the UI cannot show what the table cannot store.
//
// Backend: /api/v1/admin/leave-types (GET, POST) and /[id] (GET, PATCH, DELETE),
// SUPER_ADMIN / OWNER only.
// ============================================================================

export type LeaveType = {
  id: string;
  name: string;
  code: string;
  isPaid: boolean;
  maxPerYear: number;
  isActive: boolean;
};

/** The lib/response.ts envelope every route returns. */
export type ApiEnvelope<T> = {
  success: boolean;
  message: string;
  data?: T;
  errors?: Record<string, string[]>;
};

export type PaginatedData<T> = {
  items: T[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
};

/** Editable draft the form works with. `code` is create-only (immutable after). */
export type LeaveTypeDraft = {
  name: string;
  code: string;
  maxPerYear: string;
  isPaid: boolean;
  isActive: boolean;
};

export type SortKey = "name" | "code" | "maxPerYear";
export type SortOrder = "asc" | "desc";
export type ActiveFilter = "all" | "active" | "inactive";
export type PaidFilter = "all" | "paid" | "unpaid";
