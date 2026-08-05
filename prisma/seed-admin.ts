import "dotenv/config";
import prisma from "../lib/db";
import { hashPassword } from "../lib/password";

// Production super admin setup — run once on a fresh database.
//   npx tsx prisma/seed-admin.ts
//
// Idempotent: safe to re-run. Does NOT touch any other data.

const EMAIL = "renzosalons@gmail.com";
const PASSWORD = "Renzo@2026";

async function main() {
  const passwordHash = await hashPassword(PASSWORD);

  const user = await prisma.user.upsert({
    where: { email: EMAIL },
    update: { passwordHash, userType: "SUPER_ADMIN", isActive: true, isVerified: true },
    create: {
      email: EMAIL,
      passwordHash,
      userType: "SUPER_ADMIN",
      isActive: true,
      isVerified: true,
    },
  });

  await prisma.staffProfile.upsert({
    where: { userId: user.id },
    update: { firstName: "Renzo", lastName: "Admin", email: EMAIL },
    create: {
      userId: user.id,
      firstName: "Renzo",
      lastName: "Admin",
      email: EMAIL,
    },
  });

  console.log("✓ Super admin created");
  console.log("  Email:   ", EMAIL);
  console.log("  Password:", PASSWORD);
  console.log("  Login:   /staff/login");
  console.log("\n  Change your password after first login.");
}

main()
  .catch((e) => { console.error(e); process.exit(1); })
  .finally(() => prisma.$disconnect());
