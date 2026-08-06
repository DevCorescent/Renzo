import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { jwtVerify } from "jose";
import prisma from "@/lib/db";
import type { AuthUser } from "@/types/api";

const SECRET = new TextEncoder().encode(
  process.env.JWT_SECRET ?? "changeme-set-JWT_SECRET-in-env"
);

export async function getServerUser(): Promise<AuthUser | null> {
  const jar = await cookies();
  const token = jar.get("renzo_token")?.value;
  if (!token) return null;
  try {
    const { payload } = await jwtVerify(token, SECRET);
    return payload as unknown as AuthUser;
  } catch {
    return null;
  }
}

// Page-level guard for Branch Admin modules. Call at the top of a page:
//   await requireModule("workers");
// An empty StaffProfile.permissions means "not configured", which keeps the
// pre-existing behaviour of granting every module.
export async function requireModule(moduleKey: string): Promise<AuthUser> {
  const authUser = await getServerUser();
  if (!authUser) redirect("/login");

  const staff = await prisma.staffProfile.findUnique({
    where: { userId: authUser.userId },
    select: { permissions: true },
  });

  const permissions = staff?.permissions ?? [];
  if (permissions.length > 0 && !permissions.includes(moduleKey)) {
    redirect("/unauthorized");
  }
  return authUser;
}
