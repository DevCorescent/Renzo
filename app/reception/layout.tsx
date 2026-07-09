// OWNER: Hemant | LAYOUT: Reception Panel
import { AppShell } from "@/components/shared/app-shell";

export default function ReceptionLayout({ children }: { children: React.ReactNode }) {
  return <AppShell role="reception">{children}</AppShell>;
}
