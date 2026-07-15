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

// ── Leave Types (HR master data) ────────────────────────────────────────────
// The six defaults RENZO ships with. Only the columns that exist on LeaveType —
// name, code, isPaid, maxPerYear, isActive — are set; nothing invented.
type LeaveTypeSeed = {
  name: string;
  code: string;
  isPaid: boolean;
  maxPerYear: number;
  isActive: boolean;
};

const LEAVE_TYPES: LeaveTypeSeed[] = [
  { name: "Casual Leave",    code: "CL",  isPaid: true,  maxPerYear: 12,  isActive: true },
  { name: "Sick Leave",      code: "SL",  isPaid: true,  maxPerYear: 12,  isActive: true },
  { name: "Earned Leave",    code: "EL",  isPaid: true,  maxPerYear: 18,  isActive: true },
  { name: "Maternity Leave", code: "ML",  isPaid: true,  maxPerYear: 180, isActive: true },
  { name: "Paternity Leave", code: "PL",  isPaid: true,  maxPerYear: 15,  isActive: true },
  { name: "Loss Of Pay",     code: "LOP", isPaid: false, maxPerYear: 365, isActive: true },
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

/**
 * Insert the six default leave types, ONCE. Idempotent by design:
 *
 *   upsert(where: { code }, update: {}, create: {...})
 *
 * `code` is the model's unique column, so the upsert is an atomic insert-if-absent
 * on that constraint — running the seed any number of times, even concurrently,
 * can never create a duplicate (a second racing insert loses to the unique index
 * and resolves to the existing row). `update: {}` is deliberate: if an admin has
 * since edited a type (renamed it, changed maxPerYear, deactivated it) the seed
 * must not clobber that — it only fills in what is missing, it never overwrites.
 */
async function seedLeaveTypes() {
  for (const lt of LEAVE_TYPES) {
    // Normalize/validate exactly as the admin POST route does, so seeded rows are
    // indistinguishable from API-created ones. The static data already satisfies
    // this; the guards make the invariant explicit rather than assumed.
    const code = lt.code.trim().toUpperCase().replace(/\s+/g, "");
    const name = lt.name.trim();
    if (!name) throw new Error(`Leave type ${lt.code} has an empty name`);
    if (!code) throw new Error(`Leave type ${lt.name} has an empty code`);
    if (!Number.isInteger(lt.maxPerYear) || lt.maxPerYear < 0) {
      throw new Error(`Leave type ${code} has an invalid maxPerYear`);
    }

    await prisma.leaveType.upsert({
      where: { code },
      update: {},
      create: {
        name,
        code,
        isPaid: lt.isPaid,
        maxPerYear: lt.maxPerYear,
        isActive: lt.isActive,
      },
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

  console.log("Seeding leave types…");
  await seedLeaveTypes();

  console.log("\n✅ Demo users ready. Password for all:  " + DEMO_PASSWORD);
  console.table([
    ...STAFF.map((s) => ({ email: s.email, role: s.userType })),
    { email: "worker@renzo.dev", role: "WORKER" },
    { email: "customer@renzo.dev", role: "CUSTOMER" },
  ]);

  console.log("\n✅ Leave types ready.");
  console.table(
    LEAVE_TYPES.map((l) => ({
      name: l.name,
      code: l.code,
      paid: l.isPaid ? "Paid" : "Unpaid",
      maxPerYear: l.maxPerYear,
      active: l.isActive,
    }))
  );

  console.log("\nLogin:  POST /api/v1/auth/login  { \"email\": \"super@renzo.dev\", \"password\": \"" + DEMO_PASSWORD + "\" }");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
