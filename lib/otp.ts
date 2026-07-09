import type { OtpPurpose } from "@prisma/client";

// OWNER: Shalmon | MODULE: Auth — OTP helpers

export const OTP_TTL_SECONDS = 5 * 60; // 5 minutes
export const OTP_MAX_ATTEMPTS = 5;

export const OTP_PURPOSES: OtpPurpose[] = [
  "LOGIN",
  "SIGNUP",
  "FORGOT_PASSWORD",
  "PHONE_VERIFY",
  "EMAIL_VERIFY",
];

// Cryptographically-random 6-digit code (uniform, avoids Math.random bias).
export function generateOtp(): string {
  const n = crypto.getRandomValues(new Uint32Array(1))[0] % 1_000_000;
  return n.toString().padStart(6, "0");
}

// Normalize the delivery channel from a request body.
export function parseChannel(body: {
  phone?: unknown;
  email?: unknown;
}): { phone: string | null; email: string | null } {
  const phone =
    typeof body.phone === "string" && body.phone.trim()
      ? body.phone.trim()
      : null;
  const email =
    typeof body.email === "string" && body.email.trim()
      ? body.email.trim().toLowerCase()
      : null;
  return { phone, email };
}

// TODO(Shalmon): wire real delivery once RESEND_API_KEY / WHATSAPP_API_TOKEN
// are set (see .env). For now log to the server so dev/testing can proceed.
export async function deliverOtp(
  channel: { phone: string | null; email: string | null },
  otp: string
): Promise<void> {
  const target = channel.phone ?? channel.email ?? "unknown";
  console.log(`[OTP] ${otp} -> ${target}`);
}
