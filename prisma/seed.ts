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

// ════════════════════════════════════════════════════════════════════════════
// DEMO BOOKING DATA — branches in multiple cities, a service catalog, stylists,
// customers, real bookings and reviews. This is what makes the /book flow show
// live time-slots (slots need branch open-hours + a stylist qualified for the
// service). Everything is idempotent (upserts keyed on natural unique columns).
// ════════════════════════════════════════════════════════════════════════════

const CITY_BRANCHES = [
  { name: "Renzo Bandra",          slug: "renzo-bandra",      code: "RENZO-MUM", city: "Mumbai",    state: "Maharashtra", pincode: "400050", phone: "02226000001", address: "12 Linking Road, Bandra West" },
  { name: "Renzo Connaught Place", slug: "renzo-cp",          code: "RENZO-DEL", city: "New Delhi", state: "Delhi",       pincode: "110001", phone: "01143000002", address: "5 Connaught Place, Block A" },
  { name: "Renzo Koramangala",     slug: "renzo-koramangala", code: "RENZO-BLR", city: "Bengaluru", state: "Karnataka",   pincode: "560034", phone: "08040000003", address: "80 Feet Road, 4th Block" },
  { name: "Renzo Jubilee Hills",   slug: "renzo-jubilee",     code: "RENZO-HYD", city: "Hyderabad", state: "Telangana",   pincode: "500033", phone: "04044000004", address: "Road No. 36, Jubilee Hills" },
];

const CATEGORIES = [
  { key: "hair",  name: "Hair",  slug: "hair" },
  { key: "skin",  name: "Skin",  slug: "skin" },
  { key: "nails", name: "Nails", slug: "nails" },
];

const CATALOG = [
  { key: "haircut", name: "Haircut & Style",   slug: "haircut-style",    cat: "hair",  basePrice: 500,  duration: 45, gender: "UNISEX" as const },
  { key: "spa",     name: "Hair Spa",          slug: "hair-spa",         cat: "hair",  basePrice: 1200, duration: 60, gender: "UNISEX" as const },
  { key: "beard",   name: "Beard Grooming",    slug: "beard-grooming",   cat: "hair",  basePrice: 300,  duration: 30, gender: "MALE"   as const },
  { key: "facial",  name: "Signature Facial",  slug: "signature-facial", cat: "skin",  basePrice: 1500, duration: 60, gender: "UNISEX" as const },
  { key: "mani",    name: "Classic Manicure",  slug: "classic-manicure", cat: "nails", basePrice: 700,  duration: 45, gender: "UNISEX" as const },
  { key: "pedi",    name: "Classic Pedicure",  slug: "classic-pedicure", cat: "nails", basePrice: 900,  duration: 45, gender: "UNISEX" as const },
];

const STYLISTS = [
  { email: "aarav@renzo.dev",  phone: "9100000001", code: "EMP-MUM-01", firstName: "Aarav",  lastName: "Mehta",  gender: "MALE"   as const, branch: "renzo-bandra",      services: ["haircut", "beard", "spa"], bio: "Precision cuts & classic grooming." },
  { email: "diya@renzo.dev",   phone: "9100000002", code: "EMP-MUM-02", firstName: "Diya",   lastName: "Kapoor", gender: "FEMALE" as const, branch: "renzo-bandra",      services: ["facial", "mani", "pedi"],  bio: "Skin & nail specialist." },
  { email: "kabir@renzo.dev",  phone: "9100000003", code: "EMP-DEL-01", firstName: "Kabir",  lastName: "Singh",  gender: "MALE"   as const, branch: "renzo-cp",          services: ["haircut", "beard"],        bio: "Modern men's styling." },
  { email: "ananya@renzo.dev", phone: "9100000004", code: "EMP-DEL-02", firstName: "Ananya", lastName: "Reddy",  gender: "FEMALE" as const, branch: "renzo-cp",          services: ["spa", "facial"],           bio: "Hair spa & facial expert." },
  { email: "rohan@renzo.dev",  phone: "9100000005", code: "EMP-BLR-01", firstName: "Rohan",  lastName: "Verma",  gender: "MALE"   as const, branch: "renzo-koramangala", services: ["haircut", "beard", "spa"], bio: "All-round hair expert." },
  { email: "isha@renzo.dev",   phone: "9100000006", code: "EMP-BLR-02", firstName: "Isha",   lastName: "Nair",   gender: "FEMALE" as const, branch: "renzo-koramangala", services: ["facial", "mani", "pedi"],  bio: "Beauty & nail artistry." },
  { email: "farah@renzo.dev",  phone: "9100000007", code: "EMP-HYD-01", firstName: "Farah",  lastName: "Sheikh", gender: "FEMALE" as const, branch: "renzo-jubilee",      services: ["facial", "mani", "pedi"],  bio: "Bridal & skin specialist." },
  { email: "dev@renzo.dev",    phone: "9100000008", code: "EMP-HYD-02", firstName: "Dev",    lastName: "Malhotra", gender: "MALE" as const, branch: "renzo-jubilee",      services: ["haircut", "beard", "spa"], bio: "Men's grooming expert." },
];

const DEMO_CUSTOMERS = [
  { email: "riya.customer@renzo.dev",  phone: "9200000001", firstName: "Riya",  lastName: "Malhotra", gender: "FEMALE" as const },
  { email: "arjun.customer@renzo.dev", phone: "9200000002", firstName: "Arjun", lastName: "Nanda",    gender: "MALE"   as const },
  { email: "sara.customer@renzo.dev",  phone: "9200000003", firstName: "Sara",  lastName: "Khan",     gender: "FEMALE" as const },
];

// One branch manager (BRANCH_ADMIN) per branch — scoped to that branch.
const BRANCH_MANAGERS = [
  { email: "manager.bandra@renzo.dev",      phone: "9300000001", firstName: "Neha",    lastName: "Joshi",  branch: "renzo-bandra" },
  { email: "manager.cp@renzo.dev",          phone: "9300000002", firstName: "Vikram",  lastName: "Bhatia", branch: "renzo-cp" },
  { email: "manager.koramangala@renzo.dev", phone: "9300000003", firstName: "Priya",   lastName: "Iyer",   branch: "renzo-koramangala" },
  { email: "manager.jubilee@renzo.dev",     phone: "9300000004", firstName: "Aditya",  lastName: "Rao",    branch: "renzo-jubilee" },
];

const WEEK_OPEN = { openTime: "10:00", closeTime: "20:00" };

// UTC-midnight date N days from today — matches how the slot engine parses dates.
function utcDay(offsetDays: number): Date {
  const d = new Date();
  d.setUTCHours(0, 0, 0, 0);
  d.setUTCDate(d.getUTCDate() + offsetDays);
  return d;
}
function addMinutes(hhmm: string, mins: number): string {
  const [h, m] = hhmm.split(":").map(Number);
  const t = h * 60 + m + mins;
  return `${String(Math.floor(t / 60)).padStart(2, "0")}:${String(t % 60).padStart(2, "0")}`;
}

async function seedCatalog() {
  const cats = new Map<string, string>();
  for (const c of CATEGORIES) {
    const row = await prisma.serviceCategory.upsert({
      where: { slug: c.slug },
      update: {},
      create: { name: c.name, slug: c.slug, isActive: true },
    });
    cats.set(c.key, row.id);
  }
  const services = new Map<string, { id: string; duration: number; basePrice: number; name: string }>();
  for (const s of CATALOG) {
    const row = await prisma.service.upsert({
      where: { slug: s.slug },
      update: {},
      create: {
        name: s.name, slug: s.slug, categoryId: cats.get(s.cat)!,
        basePrice: s.basePrice, duration: s.duration, gender: s.gender, isActive: true,
      },
    });
    services.set(s.key, { id: row.id, duration: s.duration, basePrice: s.basePrice, name: s.name });
  }
  return services;
}

async function seedCityBranches() {
  const branches = new Map<string, string>();
  for (const b of CITY_BRANCHES) {
    const row = await prisma.branch.upsert({
      where: { slug: b.slug },
      update: { isActive: true, isPublic: true },
      create: {
        name: b.name, slug: b.slug, code: b.code, address: b.address,
        city: b.city, state: b.state, pincode: b.pincode, phone: b.phone,
        isActive: true, isPublic: true,
      },
    });
    branches.set(b.slug, row.id);
  }
  return branches;
}

// Open every active branch Mon–Sun so the slot engine has hours to work with.
async function ensureTimingsForAllBranches() {
  const all = await prisma.branch.findMany({ where: { isActive: true }, select: { id: true } });
  for (const b of all) {
    for (let day = 0; day <= 6; day++) {
      await prisma.branchTiming.upsert({
        where: { branchId_dayOfWeek: { branchId: b.id, dayOfWeek: day } },
        update: { isOpen: true, openTime: WEEK_OPEN.openTime, closeTime: WEEK_OPEN.closeTime },
        create: { branchId: b.id, dayOfWeek: day, isOpen: true, openTime: WEEK_OPEN.openTime, closeTime: WEEK_OPEN.closeTime },
      });
    }
  }
}

async function seedStylists(
  branches: Map<string, string>,
  services: Map<string, { id: string }>,
) {
  const passwordHash = await hashPassword(DEMO_PASSWORD);
  const out: { id: string; branchId: string; name: string; serviceIds: string[] }[] = [];
  for (const s of STYLISTS) {
    const branchId = branches.get(s.branch)!;
    const user = await prisma.user.upsert({
      where: { email: s.email },
      update: { isActive: true, isVerified: true },
      create: {
        email: s.email, phone: s.phone, passwordHash, userType: "WORKER", isVerified: true,
        workerProfile: {
          create: {
            employeeCode: s.code, firstName: s.firstName, lastName: s.lastName,
            gender: s.gender, bio: s.bio, experience: 5, isPublic: true, isActive: true,
          },
        },
      },
      include: { workerProfile: true },
    });
    const worker = user.workerProfile ?? (await prisma.workerProfile.findUnique({ where: { userId: user.id } }));
    if (!worker) continue;

    await prisma.workerBranch.upsert({
      where: { workerId_branchId: { workerId: worker.id, branchId } },
      update: { isActive: true, isPrimary: true },
      create: { workerId: worker.id, branchId, isPrimary: true, isActive: true },
    });

    const serviceIds: string[] = [];
    for (const key of s.services) {
      const svc = services.get(key);
      if (!svc) continue;
      serviceIds.push(svc.id);
      await prisma.workerService.upsert({
        where: { workerId_serviceId: { workerId: worker.id, serviceId: svc.id } },
        update: { isActive: true },
        create: { workerId: worker.id, serviceId: svc.id, isActive: true },
      });
    }
    out.push({ id: worker.id, branchId, name: `${s.firstName} ${s.lastName}`, serviceIds });
  }
  return out;
}

// Branch-scoped price rows so each catalog service is "offered" at the seeded branches.
async function seedBranchPricing(
  branches: Map<string, string>,
  services: Map<string, { id: string; basePrice: number }>,
) {
  for (const branchId of branches.values()) {
    for (const svc of services.values()) {
      await prisma.serviceBranchPricing.upsert({
        where: { serviceId_branchId: { serviceId: svc.id, branchId } },
        update: { isActive: true },
        create: { serviceId: svc.id, branchId, price: svc.basePrice, isActive: true },
      });
    }
  }
}

async function seedDemoCustomers() {
  const passwordHash = await hashPassword(DEMO_PASSWORD);
  const out: { id: string; name: string }[] = [];
  for (const c of DEMO_CUSTOMERS) {
    const user = await prisma.user.upsert({
      where: { email: c.email },
      update: { isActive: true, isVerified: true },
      create: {
        email: c.email, phone: c.phone, passwordHash, userType: "CUSTOMER", isVerified: true,
        customerProfile: { create: { firstName: c.firstName, lastName: c.lastName, email: c.email, phone: c.phone, gender: c.gender } },
      },
      include: { customerProfile: true },
    });
    const customer = user.customerProfile ?? (await prisma.customer.findUnique({ where: { userId: user.id } }));
    if (customer) out.push({ id: customer.id, name: `${c.firstName} ${c.lastName}` });
  }
  return out;
}

// Make EVERY active service bookable at EVERY active branch by putting the demo
// worker (Wasim) on every branch and qualifying them for every service — this is
// what lets even hand-created branches/services (e.g. "test3") show live slots.
async function seedUniversalCoverage() {
  const wasim = await prisma.user.findUnique({ where: { email: "worker@renzo.dev" }, include: { workerProfile: true } });
  const worker = wasim?.workerProfile;
  if (!worker) return;
  await prisma.workerProfile.update({ where: { id: worker.id }, data: { isActive: true, isPublic: true } });

  const [branches, services] = await Promise.all([
    prisma.branch.findMany({ where: { isActive: true }, select: { id: true } }),
    prisma.service.findMany({ where: { isActive: true }, select: { id: true } }),
  ]);
  for (const b of branches) {
    await prisma.workerBranch.upsert({
      where: { workerId_branchId: { workerId: worker.id, branchId: b.id } },
      update: { isActive: true },
      create: { workerId: worker.id, branchId: b.id, isActive: true },
    });
  }
  for (const s of services) {
    await prisma.workerService.upsert({
      where: { workerId_serviceId: { workerId: worker.id, serviceId: s.id } },
      update: { isActive: true },
      create: { workerId: worker.id, serviceId: s.id, isActive: true },
    });
  }
}

async function seedAppointmentsAndReviews(
  customers: { id: string; name: string }[],
  stylists: { id: string; branchId: string; name: string; serviceIds: string[] }[],
  services: Map<string, { id: string; duration: number; basePrice: number; name: string }>,
) {
  if (customers.length < 3 || stylists.length < 6) return;

  // customer index, stylist index, service key, day offset (−past/+future), start, status, optional review
  const bookings = [
    { c: 0, s: 0, svc: "haircut", day: -7, start: "11:00", status: "COMPLETED" as const, review: { rating: 5, comment: "Aarav gave me the sharpest fade — loved it!" } },
    { c: 1, s: 2, svc: "beard",   day: -5, start: "16:00", status: "COMPLETED" as const, review: { rating: 4, comment: "Great beard trim, will definitely come back." } },
    { c: 2, s: 5, svc: "facial",  day: -3, start: "13:00", status: "COMPLETED" as const, review: { rating: 5, comment: "Best facial in Bengaluru. So relaxing." } },
    { c: 0, s: 1, svc: "mani",    day: 2,  start: "12:00", status: "CONFIRMED" as const },
    { c: 1, s: 4, svc: "spa",     day: 3,  start: "15:00", status: "CONFIRMED" as const },
    { c: 2, s: 3, svc: "spa",     day: 1,  start: "17:00", status: "CONFIRMED" as const },
  ];

  let n = 1;
  for (const bk of bookings) {
    const customer = customers[bk.c];
    const stylist = stylists[bk.s];
    const service = services.get(bk.svc);
    if (!customer || !stylist || !service) continue;
    // Only book a stylist for a service they actually offer.
    if (!stylist.serviceIds.includes(service.id)) continue;

    const price = service.basePrice;
    const tax = Math.round(price * 0.18);
    const total = price + tax;
    const endTime = addMinutes(bk.start, service.duration);
    const appointmentNo = `APT-DEMO-${String(n).padStart(4, "0")}`;
    n++;

    const appt = await prisma.appointment.upsert({
      where: { appointmentNo },
      update: {},
      create: {
        appointmentNo,
        customerId: customer.id,
        branchId: stylist.branchId,
        workerId: stylist.id,
        status: bk.status,
        source: "ONLINE",
        appointmentDate: utcDay(bk.day),
        startTime: bk.start,
        endTime,
        totalDuration: service.duration,
        subtotal: price,
        taxAmount: tax,
        totalAmount: total,
        paidAmount: bk.status === "COMPLETED" ? total : 0,
        paymentStatus: bk.status === "COMPLETED" ? "PAID" : "PENDING",
        completedAt: bk.status === "COMPLETED" ? utcDay(bk.day) : null,
        services: {
          create: [{ serviceId: service.id, workerId: stylist.id, price, duration: service.duration, status: bk.status }],
        },
      },
    });

    if (bk.review) {
      await prisma.review.upsert({
        where: { appointmentId: appt.id },
        update: {},
        create: {
          appointmentId: appt.id,
          customerId: customer.id,
          branchId: stylist.branchId,
          workerId: stylist.id,
          serviceId: service.id,
          overallRating: bk.review.rating,
          workerRating: bk.review.rating,
          comment: bk.review.comment,
          status: "APPROVED",
          isPublic: true,
          approvedAt: new Date(),
        },
      });
    }
  }
}

// A BRANCH_ADMIN (branch manager) per branch, scoped to that branch via staffProfile.
async function seedBranchManagers(branches: Map<string, string>) {
  const passwordHash = await hashPassword(DEMO_PASSWORD);
  for (const m of BRANCH_MANAGERS) {
    const branchId = branches.get(m.branch);
    if (!branchId) continue;
    const user = await prisma.user.upsert({
      where: { email: m.email },
      update: { isActive: true, isVerified: true, userType: "BRANCH_ADMIN" },
      create: {
        email: m.email, phone: m.phone, passwordHash, userType: "BRANCH_ADMIN", isVerified: true,
        staffProfile: { create: { firstName: m.firstName, lastName: m.lastName, email: m.email, phone: m.phone, branchId } },
      },
      include: { staffProfile: true },
    });
    // Keep the profile pinned to this branch on re-runs.
    if (user.staffProfile) {
      await prisma.staffProfile.update({
        where: { id: user.staffProfile.id },
        data: { branchId, firstName: m.firstName, lastName: m.lastName },
      });
    } else {
      await prisma.staffProfile.create({
        data: { userId: user.id, firstName: m.firstName, lastName: m.lastName, email: m.email, phone: m.phone, branchId },
      });
    }
  }
}

async function seedBookingDemo() {
  console.log("Seeding demo booking data…");
  const services = await seedCatalog();
  const branches = await seedCityBranches();
  await seedBranchManagers(branches);
  await seedBranchPricing(branches, services);
  const stylists = await seedStylists(branches, services);
  const customers = await seedDemoCustomers();
  await ensureTimingsForAllBranches();
  await seedUniversalCoverage();
  await seedAppointmentsAndReviews(customers, stylists, services);
  console.log("✅ Booking demo ready: 3 city branches, 6 stylists, open hours, pricing, bookings & reviews.");
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

  await seedBookingDemo();

  console.log("\nLogin:  POST /api/v1/auth/login  { \"email\": \"super@renzo.dev\", \"password\": \"" + DEMO_PASSWORD + "\" }");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
