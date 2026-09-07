-- Migration: OTHERS expense category + sheet_logs table
-- Apply via Neon SQL console or: npx prisma db execute --file prisma/migrations/20260907000000_expenses_others_and_sheet_logs/migration.sql
-- Guards make every statement idempotent.

-- 1. Add OTHERS to ExpenseCategory enum (no-op if already present)
ALTER TYPE "ExpenseCategory" ADD VALUE IF NOT EXISTS 'OTHERS';

-- 2. Add customCategory column to expenses (no-op if already present)
ALTER TABLE "expenses" ADD COLUMN IF NOT EXISTS "customCategory" TEXT;

-- 3. Create sheet_logs table (no-op if already present)
CREATE TABLE IF NOT EXISTS "sheet_logs" (
    "id"        TEXT NOT NULL,
    "branchId"  TEXT NOT NULL,
    "date"      DATE NOT NULL,
    "cells"     JSONB NOT NULL DEFAULT '{}',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "sheet_logs_pkey" PRIMARY KEY ("id")
);

-- 4. Unique constraint + index on sheet_logs
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'sheet_logs_branchId_date_key'
  ) THEN
    ALTER TABLE "sheet_logs"
      ADD CONSTRAINT "sheet_logs_branchId_date_key" UNIQUE ("branchId", "date");
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS "sheet_logs_branchId_date_idx" ON "sheet_logs"("branchId", "date");

-- 5. Foreign key from sheet_logs to branches
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'sheet_logs_branchId_fkey'
  ) THEN
    ALTER TABLE "sheet_logs"
      ADD CONSTRAINT "sheet_logs_branchId_fkey"
      FOREIGN KEY ("branchId") REFERENCES "branches"("id")
      ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;
