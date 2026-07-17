import type { UserType } from "@/types/api";

/** Public customer sign-in / sign-up. */
export const CUSTOMER_LOGIN_PATH = "/login";

/**
 * Staff & admin password sign-in. Not linked from the public UI — share the
 * URL directly with employees.
 */
export const STAFF_LOGIN_PATH = "/staff/login";

const STAFF_ROLES = new Set<UserType>([
  "SUPER_ADMIN",
  "OWNER",
  "BRANCH_ADMIN",
  "RECEPTIONIST",
  "WORKER",
  "INVENTORY_MANAGER",
  "MARKETING_MANAGER",
  "ACCOUNTANT",
]);

export function isStaffRole(userType: UserType): boolean {
  return STAFF_ROLES.has(userType);
}

export const HOME_FOR: Record<UserType, string> = {
  SUPER_ADMIN: "/super-admin/dashboard",
  OWNER: "/branch-admin/dashboard",
  BRANCH_ADMIN: "/branch-admin/dashboard",
  RECEPTIONIST: "/reception/dashboard",
  WORKER: "/worker/dashboard",
  CUSTOMER: "/customer/dashboard",
  INVENTORY_MANAGER: "/inventory/dashboard",
  MARKETING_MANAGER: "/marketing/dashboard",
  ACCOUNTANT: "/accountant/dashboard",
};

export function loginPathForRole(userType: UserType): string {
  return userType === "CUSTOMER" ? CUSTOMER_LOGIN_PATH : STAFF_LOGIN_PATH;
}
