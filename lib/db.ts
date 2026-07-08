import { PrismaClient } from "@prisma/client";
import { PrismaNeon } from "@prisma/adapter-neon";
import { Pool, neonConfig } from "@neondatabase/serverless";

declare global {
  // eslint-disable-next-line no-var
  var prisma: PrismaClient | undefined;
}

function createPrismaClient() {
  if (process.env.NODE_ENV === "production") {
    // Edge/serverless: use Neon HTTP driver
    const pool = new Pool({ connectionString: process.env.DATABASE_URL! });
    const adapter = new PrismaNeon(pool);
    return new PrismaClient({ adapter } as any);
  }
  // Development: use standard TCP connection via pg
  return new PrismaClient({
    log: ["query", "error", "warn"],
  });
}

// Prevent multiple Prisma instances in dev due to hot reloading
const prisma = globalThis.prisma ?? createPrismaClient();

if (process.env.NODE_ENV !== "production") {
  globalThis.prisma = prisma;
}

export default prisma;
