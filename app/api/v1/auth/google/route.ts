import { NextRequest } from "next/server";
import { Prisma } from "@prisma/client";
import { ok, err } from "@/lib/response";
import { toPublicUser } from "@/lib/auth-user";
import { issueSession } from "@/lib/auth-session";
import {
  verifyGoogleIdToken,
  signInGoogleCustomer,
  GoogleAuthError,
} from "@/lib/google";

// OWNER: Shalmon | MODULE: Auth — Google sign-in (CUSTOMER only)
// POST /api/v1/auth/google — Trade a Google Identity Services ID token for the
// same JWT session cookie that login/otp-verify issue (see issueSession). An
// unknown email auto-registers a CUSTOMER, mirroring the phone-OTP flow.
// Body: { credential }  ← the ID token from google.accounts.id
export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => null);
    if (!body || typeof body !== "object") {
      return err("Invalid JSON body", 400);
    }

    const credential: string =
      typeof body.credential === "string" ? body.credential.trim() : "";
    if (!credential) {
      return err("Validation failed", 422, {
        credential: ["Google credential is required"],
      });
    }

    // 1. Prove the token came from Google and is meant for us.
    const profile = await verifyGoogleIdToken(credential);

    // 2. Link or auto-register the customer account behind that identity.
    const result = await signInGoogleCustomer(profile);
    if (!result.ok) {
      return err(result.message, result.status);
    }

    // 3. Issue the SAME session as password/OTP login — no duplicate JWT logic.
    const res = ok({ user: toPublicUser(result.user) }, "Logged in with Google");
    return await issueSession(req, res, result.user);
  } catch (e) {
    if (e instanceof GoogleAuthError) {
      return err(e.message, 401);
    }
    // P2002 = unique violation: two tabs racing the same first-time sign-in.
    if (
      e instanceof Prisma.PrismaClientKnownRequestError &&
      e.code === "P2002"
    ) {
      return err("Account already exists — please try again", 409);
    }
    return err("Internal server error", 500);
  }
}
