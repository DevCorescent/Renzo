// OWNER: Gauransh
// MODULE: Services & Categories Management (shared types & helpers)
//
// Shapes mirror EXACTLY what the existing admin APIs return — GET /admin/services,
// /admin/services/categories and the new /admin/services/subcategories read. A field
// absent from those responses is absent here, so the UI can never render an invented
// value. Service and ServiceCategory are global (no branchId), so nothing branch-
// scoped appears; RBAC — not branch scope — governs who may mutate.

export type Gender = "MALE" | "FEMALE" | "UNISEX";

export type CategoryRef = { id: string; name: string; slug: string };

/** One service row, as GET /api/v1/admin/services selects it. */
export type ServiceRow = {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  image: string | null;
  basePrice: number;
  duration: number;
  bufferTime: number;
  gender: Gender;
  taxPercent: number;
  isActive: boolean;
  isPopular: boolean;
  sortOrder: number;
  createdAt: string;
  category: CategoryRef | null;
  subCategory: CategoryRef | null;
};

/** One category row, as GET /api/v1/admin/services/categories selects it. */
export type CategoryRow = {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  image: string | null;
  icon: string | null;
  gender: Gender;
  isActive: boolean;
  sortOrder: number;
  createdAt: string;
  _count: { services: number; subCategories: number };
};

export type SubCategory = { id: string; name: string; slug: string; categoryId: string; isActive: boolean };

/** Role-derived capabilities, resolved on the server page from the backend's RBAC. */
export type ServiceCapabilities = {
  /** super/owner only — category Add/Edit/Delete + full service edit + service delete. */
  manageCategories: boolean;
  createService: boolean;
  deleteService: boolean;
  /** Full field edit (super/owner) vs restricted image+description edit (branch admin). */
  editFull: boolean;
  editRestricted: boolean;
};

export type ApiEnvelope<T> = {
  success: boolean;
  message: string;
  data?: T;
  errors?: Record<string, string[]>;
};

export type Paginated<T> = { items: T[]; total: number; page: number; limit: number; totalPages: number };

export const GENDERS: { value: Gender; label: string }[] = [
  { value: "UNISEX", label: "Unisex" },
  { value: "MALE", label: "Male" },
  { value: "FEMALE", label: "Female" },
];

export const money = (n: number) => `₹${Math.round(n).toLocaleString("en-IN")}`;

/** ISO → "12 Jul 2026", UTC-pinned for stable server/client rendering. */
export function formatDate(iso: string | null): string {
  if (!iso) return "—";
  const ms = Date.parse(iso);
  if (Number.isNaN(ms)) return "—";
  return new Date(ms).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric", timeZone: "UTC" });
}
