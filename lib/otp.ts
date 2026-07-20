import type { OtpPurpose } from "@prisma/client";
import { sendMail } from "@/lib/mailer";
import { otpEmail } from "@/lib/email-templates";

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

// Delivers the OTP via email (SMTP) when an email channel is provided.
// Phone/WhatsApp delivery is a future integration — logs to console for now.
export async function deliverOtp(
  channel: { phone: string | null; email: string | null },
  otp: string,
  opts?: { name?: string; purpose?: string }
): Promise<void> {
  if (channel.email) {
    const { subject, html, text } = otpEmail(opts?.name ?? "", otp, opts?.purpose ?? "LOGIN");
    await sendMail({ to: channel.email, subject, html, text });
  }

  if (channel.phone) {
    // WhatsApp/SMS integration placeholder — log in dev until provider is wired.
    console.log(`[OTP] ${otp} -> ${channel.phone}`);
  }
}
