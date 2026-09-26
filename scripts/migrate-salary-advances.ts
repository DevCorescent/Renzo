// One-off migration: create the salary_advances table.
// Run with: npx tsx scripts/migrate-salary-advances.ts
// Uses Neon HTTP driver — works in environments where TCP is blocked.

import { neon } from "@neondatabase/serverless";

async function main() {
  const sql = neon(process.env.DATABASE_URL!);

  await sql`
    CREATE TABLE IF NOT EXISTS salary_advances (
      id         TEXT        NOT NULL PRIMARY KEY,
      "workerId" TEXT        NOT NULL,
      "branchId" TEXT        NOT NULL,
      amount     DOUBLE PRECISION NOT NULL,
      type       TEXT        NOT NULL DEFAULT 'ADVANCE',
      reason     TEXT,
      notes      TEXT,
      "givenBy"  TEXT,
      "createdAt" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      CONSTRAINT fk_salary_advances_worker
        FOREIGN KEY ("workerId") REFERENCES worker_profiles(id) ON DELETE CASCADE,
      CONSTRAINT fk_salary_advances_branch
        FOREIGN KEY ("branchId") REFERENCES branches(id)
    )
  `;

  await sql`
    CREATE INDEX IF NOT EXISTS salary_advances_worker_idx
      ON salary_advances ("workerId")
  `;

  console.log("✅  salary_advances table created (or already existed).");
}

main().catch((err) => { console.error(err); process.exit(1); });
