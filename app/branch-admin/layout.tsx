// OWNER: Hemant | LAYOUT: Branch Admin Panel
import { AppShell } from "@/components/shared/app-shell";

export default function BranchAdminLayout({ children }: { children: React.ReactNode }) {
  return <AppShell role="branch-admin">{children}</AppShell>;
}
