-- Add the OTHERS expense category and a free-text label column for it.
-- Applied to the live Neon database directly via the HTTP driver (the CLI could
-- not reach TCP 5432); this file exists so fresh environments pick it up too.
-- Guards keep it idempotent.

ALTER TYPE "ExpenseCategory" ADD VALUE IF NOT EXISTS 'OTHERS';

ALTER TABLE "expenses" ADD COLUMN IF NOT EXISTS "customCategory" TEXT;
