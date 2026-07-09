// OWNER: Hemant | LAYOUT: Super Admin Panel
import { AppShell } from "@/components/shared/app-shell";

export default function SuperAdminLayout({ children }: { children: React.ReactNode }) {
  return <AppShell role="super-admin">{children}</AppShell>;
}
