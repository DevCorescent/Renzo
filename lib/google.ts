import { OAuth2Client, type TokenPayload } from "google-auth-library";
import prisma from "@/lib/db";
import { USER_INCLUDE, type UserWithProfiles } from "@/lib/auth-user";

// OWNER: Shalmon | MODULE: Auth — Google Identity Services
// Two halves of Google sign-in, kept out of the route handler so both can be
// exercised in isolation:
//   1. verifyGoogleIdToken  — proves the token really came from Google.
//   2. signInGoogleCustomer — maps the verified profile to a CUSTOMER account.
// Step 1 IS the security boundary for /api/v1/auth/google: it validates Google's
// signature, the issuer, the expiry, and — critically — that `aud` is OUR
// client id, so a token minted for some other site cannot be replayed here.

export type GoogleProfile = {
  googleId: string; // Google's `sub` — stable even if the user changes email
  email: string;
  firstName: string;
  lastName: string | null;
  picture: string | null;
};

// Thrown for anything the caller should surface as a 401 rather than a 500.
export class GoogleAuthError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "GoogleAuthError";
  }
}

let client: OAuth2Client | undefined;

export async function verifyGoogleIdToken(
  idToken: string
): Promise<GoogleProfile> {
  const clientId = process.env.GOOGLE_CLIENT_ID;
  if (!clientId) {
    // Misconfiguration, not a bad token — never fall through to "trust it".
    throw new GoogleAuthError("Google sign-in is not configured");
  }

  client ??= new OAuth2Client(clientId);

  let payload: TokenPayload | undefined;
  try {
    const ticket = await client.verifyIdToken({ idToken, audience: clientId });
    payload = ticket.getPayload();
  } catch {
    // Bad signature, wrong audience, expired — all indistinguishable to us.
    throw new GoogleAuthError("Invalid or expired Google token");
  }

  if (!payload?.sub) throw new GoogleAuthError("Malformed Google token");
  if (!payload.email) throw new GoogleAuthError("Google account has no email");

  // An unverified Google address proves nothing — accepting it would let
  // someone claim an email they do not own and take over that account below.
  if (!payload.email_verified) {
    throw new GoogleAuthError("Google email address is not verified");
  }

  const email = payload.email.toLowerCase();
  const firstName =
    payload.given_name?.trim() ||
    payload.name?.trim().split(/\s+/)[0] ||
    email.split("@")[0];

  return {
    googleId: payload.sub,
    email,
    firstName,
    lastName: payload.family_name?.trim() || null,
    picture: payload.picture ?? null,
  };
}

export type GoogleSignInResult =
  | { ok: true; user: UserWithProfiles }
  | { ok: false; status: number; message: string };

// Map a VERIFIED Google profile onto a customer account. Never call this with
// an unverified profile — verifyGoogleIdToken is what makes the email
// trustworthy, and everything below treats the email as proof of identity.
export async function signInGoogleCustomer(
  profile: GoogleProfile
): Promise<GoogleSignInResult> {
  // Match on googleId first so a linked account still resolves if the user
  // later changes the email on their Google account.
  const existing = await prisma.user.findFirst({
    where: { OR: [{ googleId: profile.googleId }, { email: profile.email }] },
    include: USER_INCLUDE,
  });

  // Unknown email — auto-register a customer, mirroring the phone-OTP flow.
  if (!existing) {
    const user = await prisma.user.create({
      data: {
        email: profile.email,
        googleId: profile.googleId,
        userType: "CUSTOMER",
        isVerified: true, // Google already verified the address for us
        customerProfile: {
          create: {
            firstName: profile.firstName,
            lastName: profile.lastName,
            email: profile.email,
            profilePhoto: profile.picture,
          },
        },
      },
      include: USER_INCLUDE,
    });
    return { ok: true, user };
  }

  // Google is a customer-only entry point. Staff, workers and admins keep their
  // password flow — a Google token must never mint a staff session.
  if (existing.userType !== "CUSTOMER") {
    return {
      ok: false,
      status: 409,
      message:
        "This email is registered as a staff account — sign in with your password",
    };
  }

  if (!existing.isActive) {
    return { ok: false, status: 403, message: "Account is disabled" };
  }

  // First Google sign-in for a customer who already exists via OTP/password:
  // link the accounts rather than creating a duplicate or failing on the
  // unique email.
  if (!existing.googleId || !existing.isVerified) {
    const user = await prisma.user.update({
      where: { id: existing.id },
      data: { googleId: profile.googleId, isVerified: true },
      include: USER_INCLUDE,
    });
    return { ok: true, user };
  }

  return { ok: true, user: existing };
}
