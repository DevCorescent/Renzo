import { NextRequest } from "next/server";
import type { OtpPurpose } from "@prisma/client";
import { ok, err } from "@/lib/response";
import prisma from "@/lib/db";
import { parseChannel, OTP_MAX_ATTEMPTS, OTP_PURPOSES } from "@/lib/otp";
import { USER_INCLUDE, toPublicUser } from "@/lib/auth-user";
import { issueSession } from "@/lib/auth-session";

// OWNER: Shalmon | MODULE: Auth — OTP Verify
// POST /api/v1/auth/otp/verify — Verify an OTP and issue a JWT session cookie.
// A phone-based LOGIN for an unknown number auto-registers a CUSTOMER account.
// Body: { phone? | email?, otp, purpose? }
export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => null);
    if (!body || typeof body !== "object") {
      return err("Invalid JSON body", 400);
    }

    const { phone, email } = parseChannel(body);
    const otp = typeof body.otp === "string" ? body.otp.trim() : "";

    // Optional display name — used only when this OTP auto-registers a NEW
    // customer (e.g. from the booking flow). Existing accounts keep their name.
    const nameInput =
      typeof body.firstName === "string" ? body.firstName.trim()
      : typeof body.name === "string" ? body.name.trim()
      : "";
    const nameParts = nameInput.split(/\s+/).filter(Boolean);
    const newFirstName = nameParts[0] || "Guest";
    const newLastName = nameParts.slice(1).join(" ") || null;

    const errors: Record<string, string[]> = {};
    if (!phone && !email) errors.identifier = ["Provide a phone or email"];
    if (!otp) errors.otp = ["OTP is required"];
    if (Object.keys(errors).length) {
      return err("Validation failed", 422, errors);
    }

    const purpose: OtpPurpose = OTP_PURPOSES.includes(body.purpose)
      ? body.purpose
      : "LOGIN";

    const record = await prisma.otpLog.findFirst({
      where: { purpose, isUsed: false, ...(phone ? { phone } : { email }) },
      orderBy: { createdAt: "desc" },
    });

    if (!record) {
      return err("No active OTP — request a new one", 400);
    }
    if (record.expiresAt < new Date()) {
      return err("OTP expired — request a new one", 400);
    }
    if (record.attempts >= OTP_MAX_ATTEMPTS) {
      await prisma.otpLog.update({
        where: { id: record.id },
        data: { isUsed: true },
      });
      return err("Too many attempts — request a new one", 429);
    }

    if (record.otp !== otp) {
      await prisma.otpLog.update({
        where: { id: record.id },
        data: { attempts: { increment: 1 } },
      });
      return err("Invalid OTP", 401);
    }

    // Consume the OTP.
    await prisma.otpLog.update({
      where: { id: record.id },
      data: { isUsed: true },
    });

    // Find the account for this channel; auto-register a customer if new.
    let user = await prisma.user.findFirst({
      where: phone ? { phone } : { email },
      include: USER_INCLUDE,
    });

    if (!user) {
      user = await prisma.user.create({
        data: {
          phone,
          email,
          userType: "CUSTOMER",
          isVerified: true,
          customerProfile: {
            create: {
              firstName: newFirstName,
              lastName: newLastName,
              phone: phone ?? undefined,
              email: email ?? undefined,
            },
          },
        },
        include: USER_INCLUDE,
      });
    } else if (!user.isActive) {
      return err("Account is disabled", 403);
    } else if (!user.isVerified) {
      user = await prisma.user.update({
        where: { id: user.id },
        data: { isVerified: true },
        include: USER_INCLUDE,
      });
    }

    const res = ok(
      { user: toPublicUser(user) },
      "OTP verified"
    );
    return await issueSession(req, res, user);
  } catch {
    return err("Internal server error", 500);
  }
}
