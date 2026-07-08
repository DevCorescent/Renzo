import "dotenv/config";
import type { UserType } from "@prisma/client";
import prisma from "../lib/db";
import { hashPassword } from "../lib/password";

// OWNER: Shalmon | MODULE: Auth — Demo seed
// roles get a real branchId in their JWT). Idempotent: safe to re-run.
//   Run:  npx tsx prisma/seed.ts
//   All demo accounts share the password below.

const DEMO_PASSWORD = "Renzo@2026";

type StaffSeed = {
  email: string;
  phone: string;
  userType: UserType;
  firstName: string;
  lastName: string;
  branchScoped: boolean;
};

const STAFF: StaffSeed[] = [
  { email: "super@renzo.dev",      phone: "9000000001", userType: "SUPER_ADMIN",       firstName: "Sana",   lastName: "Kapoor",  branchScoped: false },
  { email: "owner@renzo.dev",      phone: "9000000002", userType: "OWNER",             firstName: "Omar",   lastName: "Sheikh",  branchScoped: false },
  { email: "branchadmin@renzo.dev",phone: "9000000003", userType: "BRANCH_ADMIN",      firstName: "Bhavna", lastName: "Rao",     branchScoped: true  },
  { email: "reception@renzo.dev",  phone: "9000000004", userType: "RECEPTIONIST",      firstName: "Riya",   lastName: "Menon",   branchScoped: true  },
  { email: "inventory@renzo.dev",  phone: "9000000005", userType: "INVENTORY_MANAGER", firstName: "Imran",  lastName: "Qureshi", branchScoped: true  },
  { email: "marketing@renzo.dev",  phone: "9000000006", userType: "MARKETING_MANAGER", firstName: "Meera",  lastName: "Nair",    branchScoped: false },
  { email: "accountant@renzo.dev", phone: "9000000007", userType: "ACCOUNTANT",        firstName: "Arjun",  lastName: "Desai",   branchScoped: true  },
];

async function seedBranch() {
  return prisma.branch.upsert({
    where: { slug: "demo-branch" },
    update: {},
    create: {
      name: "Renzo Demo Salon",
      slug: "demo-branch",
      code: "DEMO01",
      address: "123 Demo Street",
      city: "Mumbai",
      state: "Maharashtra",
      pincode: "400001",
      phone: "02240000000",
      email: "demo@renzo.dev",
    },
  });
}

async function seedStaff(a: StaffSeed, branchId: string) {
  const passwordHash = await hashPassword(DEMO_PASSWORD);
  await prisma.user.upsert({
    where: { email: a.email },
    update: { passwordHash, userType: a.userType, isActive: true, isVerified: true },
    create: {
      email: a.email,
      phone: a.phone,
      passwordHash,
      userType: a.userType,
      isVerified: true,
      staffProfile: {
        create: {
          firstName: a.firstName,
          lastName: a.lastName,
          email: a.email,
          phone: a.phone,
          branchId: a.branchScoped ? branchId : null,
        },
      },
    },
  });
}

async function seedWorker(branchId: string) {
  const passwordHash = await hashPassword(DEMO_PASSWORD);
  const user = await prisma.user.upsert({
    where: { email: "worker@renzo.dev" },
    update: { passwordHash, isActive: true, isVerified: true },
    create: {
      email: "worker@renzo.dev",
      phone: "9000000008",
      passwordHash,
      userType: "WORKER",
      isVerified: true,
      workerProfile: {
        create: {
          employeeCode: "EMP-DEMO-001",
          firstName: "Wasim",
          lastName: "Ali",
          gender: "MALE",
          isActive: true,
        },
      },
    },
    include: { workerProfile: true },
  });

  const worker =
    user.workerProfile ??
    (await prisma.workerProfile.findUnique({ where: { userId: user.id } }));

  if (worker) {
    await prisma.workerBranch.upsert({
      where: { workerId_branchId: { workerId: worker.id, branchId } },
      update: { isPrimary: true, isActive: true },
      create: { workerId: worker.id, branchId, isPrimary: true, isActive: true },
    });
  }
}

async function seedCustomer() {
  const passwordHash = await hashPassword(DEMO_PASSWORD);
  await prisma.user.upsert({
    where: { email: "customer@renzo.dev" },
    update: { passwordHash, isActive: true, isVerified: true },
    create: {
      email: "customer@renzo.dev",
      phone: "9000000009",
      passwordHash,
      userType: "CUSTOMER",
      isVerified: true,
      customerProfile: {
        create: {
          firstName: "Neha",
          lastName: "Sharma",
          email: "customer@renzo.dev",
          phone: "9000000009",
        },
      },
    },
  });
}

async function main() {
  console.log("Seeding demo users…");
  const branch = await seedBranch();
  for (const a of STAFF) await seedStaff(a, branch.id);
  await seedWorker(branch.id);
  await seedCustomer();

  console.log("\n✅ Demo users ready. Password for all:  " + DEMO_PASSWORD);
  console.table([
    ...STAFF.map((s) => ({ email: s.email, role: s.userType })),
    { email: "worker@renzo.dev", role: "WORKER" },
    { email: "customer@renzo.dev", role: "CUSTOMER" },
  ]);
  console.log("\nLogin:  POST /api/v1/auth/login  { \"email\": \"super@renzo.dev\", \"password\": \"" + DEMO_PASSWORD + "\" }");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
