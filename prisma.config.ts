import { defineConfig } from "prisma/config";
import { PrismaNeon } from "@prisma/adapter-neon";
import { config } from "dotenv";

config({ path: ".env" });

const DATABASE_URL = process.env.DATABASE_URL!;

export default defineConfig({
  earlyAccess: true,
  schema: "prisma/schema.prisma",
  datasource: {
    url: DATABASE_URL,
  },
  migrate: {
    async adapter() {
      const { neonConfig, Pool } = await import("@neondatabase/serverless");
      neonConfig.webSocketConstructor = (await import("ws")).default;
      const pool = new Pool({ connectionString: DATABASE_URL });
      return new PrismaNeon(pool);
    },
  },
});
