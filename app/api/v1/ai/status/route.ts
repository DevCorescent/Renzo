import { NextRequest } from "next/server";
import { ok } from "@/lib/response";
import { isGroqEnabled } from "@/lib/ai/groq";

// GET /api/v1/ai/status — public; whether Groq is configured
export async function GET(_req: NextRequest) {
  return ok({ enabled: isGroqEnabled() });
}
