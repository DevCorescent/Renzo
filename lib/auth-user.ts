import { Prisma } from "@prisma/client";
import type { AuthUser } from "@/types/api";

// OWNER: Shalmon | MODULE: Auth — User → session/profile mappers
// Shared shape for loading a user with the profile relations we need to
// derive the JWT claims and the `/me` response.

export const USER_INCLUDE = {
  customerProfile: true,
  staffProfile: true,
  workerProfile: { include: { branches: true } },
} satisfies Prisma.UserInclude;

export type UserWithProfiles = Prisma.UserGetPayload<{
  include: typeof USER_INCLUDE;
}>;

// Build the JWT claims — scoped ids let downstream routes skip extra lookups.
export function toAuthUser(user: UserWithProfiles): AuthUser {
  const claims: AuthUser = { userId: user.id, userType: user.userType };

  if (user.customerProfile) claims.customerId = user.customerProfile.id;

  if (user.workerProfile) {
    claims.workerId = user.workerProfile.id;
    const branches = user.workerProfile.branches;
    const primary =
      branches.find((b) => b.isPrimary && b.isActive) ??
      branches.find((b) => b.isActive) ??
      branches[0];
    if (primary) claims.branchId = primary.branchId;
  }

  // Staff (admins, reception, accountant, etc.) carry their branch directly.
  if (user.staffProfile?.branchId) claims.branchId = user.staffProfile.branchId;

  return claims;
}

// Safe, client-facing user shape for login / otp-verify / me responses.
export function toPublicUser(user: UserWithProfiles) {
  const profile =
    user.customerProfile ?? user.workerProfile ?? user.staffProfile ?? null;

  let name: string | null = null;
  if (profile) {
    const displayName =
      "displayName" in profile ? profile.displayName : null;
    const lastName = "lastName" in profile ? profile.lastName : null;
    name =
      displayName ||
      [profile.firstName, lastName].filter(Boolean).join(" ") ||
      null;
  }

  return {
    id: user.id,
    email: user.email,
    phone: user.phone,
    userType: user.userType,
    isVerified: user.isVerified,
    name,
    profilePhoto: profile?.profilePhoto ?? null,
    branchId: user.staffProfile?.branchId ?? null,
    customerId: user.customerProfile?.id ?? null,
    workerId: user.workerProfile?.id ?? null,
  };
}
