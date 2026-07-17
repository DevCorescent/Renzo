// ============================================================================
// OWNER  : Gauransh
// MODULE : Super Admin — Platform Settings
// FLOW   : GET returns the singleton PlatformConfig + derived system status;
//          PATCH validates and updates that same singleton.
// ACCESS : SUPER_ADMIN only — any other role gets the existing Forbidden (403).
// BACKEND: Reads/writes ONLY the existing PlatformConfig model (id = "global"),
//          the single source of truth. No new table, no duplicate config.
// PURPOSE: Back the one Super Admin Settings page (General / Booking / System).
// ============================================================================

import { NextRequest } from "next/server";
import { ok, err } from "@/lib/response";
import { requireAuth } from "@/lib/auth-guard";
import prisma from "@/lib/db";
import type { Prisma, PlatformConfig } from "@prisma/client";
import pkg from "@/package.json";

// The PlatformConfig is a singleton keyed by a fixed id — never per-branch, never
// duplicated. Every read/write below targets this one row.
const CONFIG_ID = "global";

// A minimal, dependency-free email check — UX/parity only; the server stays the
// authority. An empty/absent email is allowed (the field is optional).
function isValidEmail(value: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
}

// "" and non-strings collapse to null so an optional column is never stored as an
// empty string.
function optionalStr(value: unknown): string | null {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

// Read-only system status shown in the System section. Derived at request time —
// nothing is stored. `databaseConnected` is true because the config read above
// succeeded; version/environment come from the build, not hardcoded values.
function systemStatus(config: PlatformConfig, databaseConnected: boolean) {
  return {
    version: pkg.version,
    database: databaseConnected ? "Connected" : "Unavailable",
    server: "Operational",
    environment: process.env.NODE_ENV ?? "development",
    lastUpdated: config.updatedAt,
  };
}

/**
 * GET /api/v1/admin/settings
 *
 * Returns the PlatformConfig singleton plus derived system status. The row is
 * created with schema defaults ONLY if it does not yet exist (so a first load never
 * fails and never bumps `updatedAt` on subsequent loads). SUPER_ADMIN only.
 */
export async function GET(req: NextRequest) {
  const { error } = await requireAuth(req, "SUPER_ADMIN");
  if (error) return error;

  try {
    // Read-or-initialise the singleton. Create runs only when missing, so a normal
    // load is a pure read and "Last Updated" stays accurate.
    let config = await prisma.platformConfig.findUnique({ where: { id: CONFIG_ID } });
    if (!config) {
      config = await prisma.platformConfig.create({ data: { id: CONFIG_ID } });
    }

    return ok({ config, system: systemStatus(config, true) }, "Settings fetched successfully");
  } catch {
    return err("Internal server error", 500);
  }
}

/**
 * PATCH /api/v1/admin/settings
 *
 * Validates and updates the PlatformConfig singleton. Validation is server-side and
 * authoritative; failures return a field-keyed 422 so the UI can flag only the
 * offending inputs. Booking slot must be a positive integer; support email, if
 * given, must be well-formed. SUPER_ADMIN only.
 */
export async function PATCH(req: NextRequest) {
  const { error } = await requireAuth(req, "SUPER_ADMIN");
  if (error) return error;

  try {
    const body = await req.json().catch(() => null);
    if (!body || typeof body !== "object") return err("Invalid request body", 400);

    const errors: Record<string, string[]> = {};
    // Accumulate only the sent fields; cast to the Prisma input at the upsert (the
    // dynamic partial build below can't be expressed against the update-op union).
    const data: Record<string, string | number | boolean | null> = {};

    // PATCH is PARTIAL: each Settings section saves only its own fields, so a field
    // is validated and written ONLY when the client actually sent it. Fields the
    // client omits are left exactly as they are.

    // Business name — required when present (it can never be blanked).
    if (body.businessName !== undefined) {
      const v = typeof body.businessName === "string" ? body.businessName.trim() : "";
      if (!v) errors.businessName = ["Business name is required"];
      else data.businessName = v;
    }

    // Support email — optional, but must be valid when a non-empty value is given.
    if (body.supportEmail !== undefined) {
      const v = optionalStr(body.supportEmail);
      if (v && !isValidEmail(v)) errors.supportEmail = ["Enter a valid email address"];
      else data.supportEmail = v;
    }

    // Booking slot — positive integer when present.
    if (body.defaultBookingSlotMin !== undefined) {
      const slot = Number(body.defaultBookingSlotMin);
      if (!Number.isInteger(slot) || slot <= 0) errors.defaultBookingSlotMin = ["Enter a positive number of minutes"];
      else data.defaultBookingSlotMin = slot;
    }

    // Optional free-text handles/numbers — normalised so "" is stored as null.
    for (const key of ["supportPhone", "whatsappNumber", "instagramHandle", "facebookHandle", "youtubeHandle", "twitterHandle", "maintenanceMessage"] as const) {
      if (body[key] !== undefined) data[key] = optionalStr(body[key]);
    }

    // Toggles — coerced to booleans only when sent.
    for (const key of ["maintenanceMode", "reviewAutoApprove", "portfolioAutoApprove"] as const) {
      if (body[key] !== undefined) data[key] = Boolean(body[key]);
    }

    if (Object.keys(errors).length) return err("Validation failed", 422, errors);
    if (Object.keys(data).length === 0) return err("No fields provided to update", 400);

    // Upsert keeps the singleton contract even if the row was never seeded.
    const config = await prisma.platformConfig.upsert({
      where: { id: CONFIG_ID },
      update: data as Prisma.PlatformConfigUpdateInput,
      create: { id: CONFIG_ID, ...data } as Prisma.PlatformConfigUncheckedCreateInput,
    });

    return ok({ config, system: systemStatus(config, true) }, "Settings updated successfully");
  } catch {
    return err("Internal server error", 500);
  }
}
