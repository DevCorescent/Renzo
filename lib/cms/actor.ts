// OWNER: Gauransh | MODULE: Homepage CMS — actor display name
//
// Version history and the audit trail record WHO published. The JWT carries only
// an id, so the human-readable name is resolved from the existing StaffProfile —
// the same lookup the Super Admin layout already does. Read-only, and it never
// throws: a missing profile degrades to "Super Admin" rather than failing a save.

import prisma from "@/lib/db";
import type { AuthUser } from "@/types/api";

export async function resolveActorName(user: AuthUser): Promise<string> {
  try {
    const staff = await prisma.staffProfile.findFirst({
      where: { userId: user.userId },
      select: { firstName: true, lastName: true },
    });
    const name = staff ? `${staff.firstName} ${staff.lastName}`.trim() : "";
    return name || "Super Admin";
  } catch {
    return "Super Admin";
  }
}
