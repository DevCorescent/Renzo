import { z } from "zod";
import { err } from "@/lib/response";

// MODULE: Validation — single strategy, existing response contract
//
// The project had three hand-rolled validation styles plus one file
// (customer/profile) importing zod while zod was NOT in package.json — it only
// resolved as a transitive dependency, so the build would break the moment the
// dep tree shifted. zod is now a real dependency and this is the one wrapper.
//
// It deliberately emits the EXACT 422 shape the API already returns:
//
//   { success: false, message: "Validation failed", errors: { field: ["..."] } }
//
// so nothing downstream changes. Uses the existing `err()` helper — no new
// response format, no parallel implementation.
//
//   const parsed = validate(CreateWorkerSchema, await readJson(req));
//   if (parsed.error) return parsed.error;
//   const { firstName, branchId } = parsed.data;   // fully typed

export function validate<T extends z.ZodType>(
  schema: T,
  input: unknown
):
  | { data: z.infer<T>; error: null }
  | { data: null; error: ReturnType<typeof err> } {
  const parsed = schema.safeParse(input);

  if (!parsed.success) {
    const fieldErrors = parsed.error.flatten().fieldErrors as Record<
      string,
      string[]
    >;
    return { data: null, error: err("Validation failed", 422, fieldErrors) };
  }

  return { data: parsed.data, error: null };
}

/**
 * Read a JSON body without throwing. Returns null on malformed JSON, which
 * `validate()` then reports as a normal 422 rather than a 500.
 */
export async function readJson(req: Request): Promise<unknown> {
  return req.json().catch(() => null);
}
