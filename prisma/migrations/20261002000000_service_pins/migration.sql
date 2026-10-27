-- Migration: per-branch pinned services for the Walk-in "Quick add" row.
-- Apply via Neon SQL console or:
--   npx prisma db execute --file prisma/migrations/20261002000000_service_pins/migration.sql
-- Apply BEFORE deploying the code that reads "service_pins".
-- Guards make every statement idempotent.

-- 1. Table
CREATE TABLE IF NOT EXISTS "service_pins" (
    "id"        TEXT NOT NULL,
    "branchId"  TEXT NOT NULL,
    "serviceId" TEXT NOT NULL,
    "pinnedBy"  TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "service_pins_pkey" PRIMARY KEY ("id")
);

-- 2. One pin per service per branch
CREATE UNIQUE INDEX IF NOT EXISTS "service_pins_branchId_serviceId_key"
    ON "service_pins" ("branchId", "serviceId");

-- 3. Foreign keys (cascade with the branch / service)
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'service_pins_branchId_fkey') THEN
    ALTER TABLE "service_pins" ADD CONSTRAINT "service_pins_branchId_fkey"
      FOREIGN KEY ("branchId") REFERENCES "branches"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'service_pins_serviceId_fkey') THEN
    ALTER TABLE "service_pins" ADD CONSTRAINT "service_pins_serviceId_fkey"
      FOREIGN KEY ("serviceId") REFERENCES "services"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;

-- 4. Default pins — the Haircut / Beard quick-add buttons that were hardcoded in
--    the Walk-in console, carried over so the desk sees no change on deploy.
--    Same rule as the old code: names compared with case, spaces and punctuation
--    ignored; a key pins the service with exactly that name, or — where none
--    exists — every service whose name starts with it ("beard" → "Beard Styling",
--    "Beard Color"). Every active branch gets them.
--    Only branches with NO pins yet are seeded, so a re-run never re-pins
--    something an admin has since unpinned (unless that branch has no pins left).
--    Pin order is createdAt: Haircut first, then the Beard services by name —
--    stamped a few seconds in the PAST so anything an admin pins afterwards
--    always sorts after them. In UTC, as Prisma writes this column: a bare
--    CURRENT_TIMESTAMP would take the session's time zone (e.g. IST) instead.
WITH norm AS (
  SELECT "id", "name", lower(regexp_replace("name", '[^a-zA-Z0-9]', '', 'g')) AS n
  FROM "services"
  WHERE "isActive" = true
),
keys(k, ord) AS (VALUES ('haircut', 1), ('beard', 2)),
matched AS (
  SELECT s."id", s."name", k.ord FROM keys k JOIN norm s ON s.n = k.k
  UNION ALL
  SELECT s."id", s."name", k.ord FROM keys k JOIN norm s ON s.n LIKE k.k || '%'
  WHERE NOT EXISTS (SELECT 1 FROM norm e WHERE e.n = k.k)
),
picked AS (
  SELECT "id", ROW_NUMBER() OVER (ORDER BY ord, "name") AS rn, COUNT(*) OVER () AS total
  FROM matched
)
INSERT INTO "service_pins" ("id", "branchId", "serviceId", "pinnedBy", "createdAt")
SELECT 'pin_' || md5(b."id" || ':' || p."id"),
       b."id",
       p."id",
       NULL,
       (CURRENT_TIMESTAMP AT TIME ZONE 'UTC') - ((p.total - p.rn + 1) * INTERVAL '1 second')
FROM "branches" b
CROSS JOIN picked p
WHERE b."isActive" = true
  AND NOT EXISTS (SELECT 1 FROM "service_pins" sp WHERE sp."branchId" = b."id")
ON CONFLICT ("branchId", "serviceId") DO NOTHING;
