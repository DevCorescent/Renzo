import { NextRequest } from "next/server";
import { ok, err } from "@/lib/response";
import prisma from "@/lib/db";

// OWNER: Shalmon | MODULE: Public Offers

export async function GET(req: NextRequest) {
  try {
    const url = new URL(req.url);
    const branchId = url.searchParams.get("branchId") ?? undefined;
    // TODO: return active offers visible to public; filter by branchId if provided
    return ok([]);
  } catch {
    return err("Internal server error", 500);
  }
}
