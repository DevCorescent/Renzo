// OWNER: Hemant | LAYOUT: Worker Panel
import { AppShell } from "@/components/shared/app-shell";

export default function WorkerLayout({ children }: { children: React.ReactNode }) {
  return <AppShell role="worker">{children}</AppShell>;
}
