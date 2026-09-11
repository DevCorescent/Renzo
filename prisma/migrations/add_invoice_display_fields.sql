-- Add invoice display fields to branch_settings
-- Run once: npx prisma db execute --file prisma/migrations/add_invoice_display_fields.sql

ALTER TABLE branch_settings ADD COLUMN IF NOT EXISTS "invoiceBusinessName" TEXT;
ALTER TABLE branch_settings ADD COLUMN IF NOT EXISTS "invoiceTagline"      TEXT;
ALTER TABLE branch_settings ADD COLUMN IF NOT EXISTS "invoiceAddress"      TEXT;
ALTER TABLE branch_settings ADD COLUMN IF NOT EXISTS "invoicePhone"        TEXT;
ALTER TABLE branch_settings ADD COLUMN IF NOT EXISTS "invoiceEmail"        TEXT;
ALTER TABLE branch_settings ADD COLUMN IF NOT EXISTS "invoiceWebsite"      TEXT;
ALTER TABLE branch_settings ADD COLUMN IF NOT EXISTS "invoiceFooterNote"   TEXT;
