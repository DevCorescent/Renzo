import { NextRequest } from "next/server";
import { ok, err, created } from "@/lib/response";

// OWNER: Devanshi | MODULE: Public Contact
// POST /api/v1/public/contact — Validate and accept a contact enquiry (no auth)
//
// No ContactSubmission model exists yet, so we validate and acknowledge.
// Wire to email / CRM storage when available.

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => null);
    if (!body || typeof body !== "object") {
      return err("Invalid request body", 400);
    }

    const name = typeof body.name === "string" ? body.name.trim() : "";
    const email = typeof body.email === "string" ? body.email.trim() : "";
    const phone = typeof body.phone === "string" ? body.phone.trim() : "";
    const subject = typeof body.subject === "string" ? body.subject.trim() : "";
    const message = typeof body.message === "string" ? body.message.trim() : "";

    const errors: Record<string, string[]> = {};

    if (!name || name.length < 2) {
      errors.name = ["Name must be at least 2 characters"];
    } else if (name.length > 100) {
      errors.name = ["Name is too long"];
    }

    if (!email || !EMAIL_RE.test(email)) {
      errors.email = ["A valid email is required"];
    } else if (email.length > 200) {
      errors.email = ["Email is too long"];
    }

    if (phone && phone.length > 30) {
      errors.phone = ["Phone is too long"];
    }

    if (subject && subject.length > 150) {
      errors.subject = ["Subject is too long"];
    }

    if (!message || message.length < 10) {
      errors.message = ["Message must be at least 10 characters"];
    } else if (message.length > 5000) {
      errors.message = ["Message is too long"];
    }

    if (Object.keys(errors).length > 0) {
      return err("Validation failed", 400, errors);
    }

    // Acknowledge receipt — persistence/email can be added later without changing the contract.
    return created(
      {
        received: true,
        name,
        email,
        ...(phone ? { phone } : {}),
        ...(subject ? { subject } : {}),
      },
      "Thank you — your message has been received"
    );
  } catch {
    return err("Internal server error", 500);
  }
}

// Optional health check so the route is discoverable.
export async function GET() {
  return ok({ status: "ok" }, "Contact endpoint ready");
}
