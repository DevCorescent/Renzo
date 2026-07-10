import { cookies } from "next/headers";
import { jwtVerify } from "jose";
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
