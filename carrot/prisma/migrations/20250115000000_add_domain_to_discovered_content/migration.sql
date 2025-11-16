-- Add nullable domain column to discovered_content table
-- This migration adds the domain column as nullable to allow zero-downtime deployment.
-- After backfilling all rows, a follow-up migration can make it required if needed.

ALTER TABLE "discovered_content"
  ADD COLUMN IF NOT EXISTS "domain" TEXT;

-- Create index on domain for efficient filtering and grouping
CREATE INDEX IF NOT EXISTS "discovered_content_domain_idx" ON "discovered_content"("domain");

