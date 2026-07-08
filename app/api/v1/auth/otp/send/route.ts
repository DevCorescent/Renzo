import { NextRequest } from "next/server";
import type { OtpPurpose } from "@prisma/client";
import { ok, err } from "@/lib/response";
import prisma from "@/lib/db";
import {
  generateOtp,
  deliverOtp,
  parseChannel,
  OTP_TTL_SECONDS,
  OTP_PURPOSES,
} from "@/lib/otp";

// OWNER: Shalmon | MODULE: Auth — OTP Send
// POST /api/v1/auth/otp/send — Generate an OTP for a phone or email and
// deliver it (SMS/WhatsApp/email). Body: { phone? | email?, purpose? }
export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => null);
    if (!body || typeof body !== "object") {
      return err("Invalid JSON body", 400);
    }

    const { phone, email } = parseChannel(body);
    if (!phone && !email) {
      return err("Validation failed", 422, {
        identifier: ["Provide a phone or email"],
      });
    }

    const purpose: OtpPurpose = OTP_PURPOSES.includes(body.purpose)
      ? body.purpose
      : "LOGIN";

    const otp = generateOtp();
    const expiresAt = new Date(Date.now() + OTP_TTL_SECONDS * 1000);

    // Invalidate any still-active codes for this channel + purpose so only the
    // newest OTP works.
    await prisma.otpLog.updateMany({
      where: {
        purpose,
        isUsed: false,
        ...(phone ? { phone } : { email }),
      },
      data: { isUsed: true },
    });

    await prisma.otpLog.create({
      data: { phone, email, otp, purpose, expiresAt },
    });

    await deliverOtp({ phone, email }, otp);

    return ok(
      {
        sentTo: phone ?? email,
        expiresInSeconds: OTP_TTL_SECONDS,
        // Only expose the code outside production so the team can test without
        // a live SMS/email provider wired up.
        ...(process.env.NODE_ENV !== "production" ? { devOtp: otp } : {}),
      },
      "OTP sent"
    );
  } catch {
    return err("Internal server error", 500);
  }
}
