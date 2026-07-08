// ─── Standard API wrapper — every route returns this shape ───────────────────
export type ApiResponse<T = null> = {
  success: boolean;
  message: string;
  data?: T;
  errors?: Record<string, string[]>;
};

// ─── Paginated list wrapper ───────────────────────────────────────────────────
export type PaginatedData<T> = {
  items: T[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
};

// ─── User roles (mirrors Prisma enum) ────────────────────────────────────────
export type UserType =
  | "SUPER_ADMIN"
  | "OWNER"
  | "BRANCH_ADMIN"
  | "RECEPTIONIST"
  | "WORKER"
  | "INVENTORY_MANAGER"
  | "MARKETING_MANAGER"
  | "ACCOUNTANT"
  | "CUSTOMER";

// ─── Auth session stored in JWT ───────────────────────────────────────────────
export type AuthUser = {
  userId: string;
  userType: UserType;
  branchId?: string;   // set for branch-scoped roles
  workerId?: string;   // set when userType = WORKER
  customerId?: string; // set when userType = CUSTOMER
};

// ─── Common query params ──────────────────────────────────────────────────────
export type PaginationParams = {
  page: number;
  limit: number;
  skip: number;
  search?: string;
};
