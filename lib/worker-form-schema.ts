// ============================================================================
// OWNER  : Gauransh
// MODULE : Worker admission — client-side pre-flight validation
//
// THIS IS NOT THE SOURCE OF TRUTH. POST /api/v1/admin/workers is.
//
// Every rule below is a mirror of that route's own validator, kept here only so a
// user learns their phone number is malformed before a round trip rather than
// after one. The server re-validates everything and its 422s are rendered
// verbatim — so if these two ever drift, the backend still wins and the user is
// still told the truth. Nothing here can wave a bad payload through.
//
// The constants are copied deliberately rather than imported: lib/scheduling can
// be shared because it is pure, but a route handler cannot be imported into a
// client bundle without dragging Prisma and the auth guard with it.
// ============================================================================

import { z } from "zod";

// Both regexes are exactly those in app/api/v1/admin/workers/route.ts.
const PHONE_RE = /^\+?\d{10,15}$/;
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const MAX_NAME_LENGTH = 50;
const MIN_PASSWORD_LENGTH = 6;

export const MIN_WORKER_AGE = 10;

/** Blank inputs arrive as "" from FormData; the API expects them absent, not empty. */
const optionalText = z
  .string()
  .trim()
  .transform((v) => (v === "" ? undefined : v))
  .optional();

/**
 * Exact age in completed years.
 *
 * NOT `today.getFullYear() - dob.getFullYear()` — that reports an 18th birthday a
 * full year early for anyone born after today's month/day, which would admit a
 * 17-year-old. The month/day comparison below decrements when the birthday has
 * not yet fallen this year, so the answer flips on the birthday itself and not a
 * day sooner.
 *
 * Both dates are pinned to UTC midnight so the result cannot shift by a day on a
 * server running west of UTC — the same reason every date in this codebase is
 * handled in UTC.
 *
 * Leap years need no special case: someone born 29 Feb 2008 turns 18 on 28 Feb
 * 2026 by this maths (month equal, day 28 < 29 → not yet 18) and on 1 Mar 2026
 * they are. That is the conventional legal reading, and it is arrived at by the
 * ordinary comparison rather than a rule invented for it.
 */
export function calculateAge(isoDate: string, on: Date = new Date()): number {
  const dob = new Date(`${isoDate}T00:00:00.000Z`);
  if (Number.isNaN(dob.getTime())) return Number.NaN;

  const today = new Date(`${on.toISOString().slice(0, 10)}T00:00:00.000Z`);

  let age = today.getUTCFullYear() - dob.getUTCFullYear();

  const monthDelta = today.getUTCMonth() - dob.getUTCMonth();
  const beforeBirthday =
    monthDelta < 0 || (monthDelta === 0 && today.getUTCDate() < dob.getUTCDate());

  if (beforeBirthday) age -= 1;

  return age;
}

/** The latest DOB that still clears the age floor — drives the date input's `max`. */
export function maxDateOfBirth(on: Date = new Date()): string {
  const today = new Date(`${on.toISOString().slice(0, 10)}T00:00:00.000Z`);
  today.setUTCFullYear(today.getUTCFullYear() - MIN_WORKER_AGE);
  return today.toISOString().slice(0, 10);
}

export const WorkerAdmissionSchema = z.object({
  firstName: z
    .string()
    .trim()
    .min(1, "First name is required")
    .max(MAX_NAME_LENGTH, `First name must be ${MAX_NAME_LENGTH} characters or fewer`),

  lastName: z
    .string()
    .trim()
    .min(1, "Last name is required")
    .max(MAX_NAME_LENGTH, `Last name must be ${MAX_NAME_LENGTH} characters or fewer`),

  employeeCode: z.string().trim().min(1, "Employee code is required"),

  // The worker signs in with this, and the OTP flow is phone-based — which is why
  // the route requires it even though WorkerProfile.phone is nullable.
  phone: z
    .string()
    .trim()
    .min(1, "Phone is required")
    .regex(PHONE_RE, "Phone must be 10–15 digits, optionally prefixed with +"),

  email: optionalText.refine(
    (v) => v === undefined || EMAIL_RE.test(v),
    "Email is not a valid email address"
  ),

  password: z
    .string()
    .min(MIN_PASSWORD_LENGTH, `Password must be at least ${MIN_PASSWORD_LENGTH} characters`),

  // Exactly the Gender enum in the Prisma schema.
  gender: z.enum(["MALE", "FEMALE", "UNISEX"], {
    message: "Gender is required",
  }),

  displayName: optionalText,
  bio: optionalText,
  profilePhoto: optionalText,

  departmentId: optionalText,
  designationId: optionalText,

  // MANDATORY, and stricter than the route — which accepts both as optional. The
  // API is the gate for everything it checks; these two are a business rule the
  // route does not yet enforce, so a tampered request could still slip a
  // date-less worker past. See the note in the module header of the form.
  dateOfBirth: z
    .string()
    .trim()
    .min(1, "Date of birth is required")
    .refine((v) => !Number.isNaN(Date.parse(v)), "Date of birth is not a valid date")
    .refine(
      (v) => calculateAge(v) >= MIN_WORKER_AGE,
      `Worker must be at least ${MIN_WORKER_AGE} years old`
    )
    .refine((v) => calculateAge(v) < 100, "Date of birth does not look right"),

  joinDate: z
    .string()
    .trim()
    .min(1, "Joining date is required")
    .refine((v) => !Number.isNaN(Date.parse(v)), "Joining date is not a valid date"),

  experience: optionalText.refine(
    (v) => v === undefined || (Number.isFinite(Number(v)) && Number(v) >= 0),
    "Experience must be a non-negative number of years"
  ),

  // Free text on the way in; the action splits it. The API stores String[].
  languages: optionalText,
  certificates: optionalText,

  // Absent from FormData when unchecked — that is a false, not a validation error.
  isPublic: z.union([z.literal("on"), z.undefined()]).optional(),

  // branchId is ABSENT ON PURPOSE. For a BRANCH_ADMIN the route takes the branch
  // from the JWT and ignores the body entirely, so a branch admin cannot create a
  // worker in another branch even if the form were tampered with.
});

export type WorkerAdmissionInput = z.infer<typeof WorkerAdmissionSchema>;

/** FormData → plain object, so the schema can parse it. */
export function formDataToObject(data: FormData): Record<string, unknown> {
  const out: Record<string, unknown> = {};

  for (const [key, value] of data.entries()) {
    if (typeof value === "string") out[key] = value;
  }

  return out;
}

/** Zod's field errors, in the same shape the API's 422s arrive in. */
export function validateAdmission(
  data: FormData
): { ok: true } | { ok: false; errors: Record<string, string[]> } {
  const parsed = WorkerAdmissionSchema.safeParse(formDataToObject(data));

  if (parsed.success) return { ok: true };

  return {
    ok: false,
    errors: parsed.error.flatten().fieldErrors as Record<string, string[]>,
  };
}
