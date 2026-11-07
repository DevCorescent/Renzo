import { PrismaClient } from "@prisma/client";
import { PrismaNeon } from "@prisma/adapter-neon";

declare global {
  var prisma: PrismaClient | undefined;
}

function createPrismaClient() {
  const adapter = new PrismaNeon(
    { connectionString: process.env.DATABASE_URL! },
    {
      // Neon WebSocket reconnects log spurious "non-101" errors that are
      // handled internally — silence them so the console stays meaningful.
      onPoolError: () => {},
      onConnectionError: () => {},
    },
  );
  return new PrismaClient({
    adapter,
    // Omit "error" from dev logs: Neon WS reconnect noise is captured by the
    // callbacks above; real query failures still throw as exceptions.
    log: process.env.NODE_ENV === "production" ? ["error"] : ["warn"],
  });
}

// Prevent multiple Prisma instances in dev due to hot reloading
const prisma = globalThis.prisma ?? createPrismaClient();

if (process.env.NODE_ENV !== "production") {
  globalThis.prisma = prisma;
}

export default prisma;