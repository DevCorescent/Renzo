import { ExpensesPage } from "@/components/operations/operation-pages";
import type { UserType } from "@/types/api";

const ROLES: readonly UserType[] = ["BRANCH_ADMIN", "SUPER_ADMIN", "OWNER"];

export default async function BranchAdminExpensesPage() {
  return <ExpensesPage allowedRoles={ROLES} />;
}
