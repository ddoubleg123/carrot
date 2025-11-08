-- Open-Evidence Discovery v2 - PR1 schema adjustments
-- Ensure canonical URLs are present and unique, add summary fields, and extend patch metadata.

-- Backfill missing canonical URLs before enforcing NOT NULL
UPDATE "discovered_content"
SET "canonical_url" = COALESCE("canonical_url", "source_url")
WHERE "canonical_url" IS NULL;

-- Drop all but the newest record for duplicate canonical URLs scoped by patch
WITH ranked_duplicates AS (
  SELECT
    id,
    ROW_NUMBER() OVER (
      PARTITION BY "patch_id", "canonical_url"
      ORDER BY "updated_at" DESC NULLS LAST, "created_at" DESC NULLS LAST, id DESC
    ) AS row_number
  FROM "discovered_content"
  WHERE "canonical_url" IS NOT NULL
)
DELETE FROM "discovered_content" dc
USING ranked_duplicates rd
WHERE dc.id = rd.id
  AND rd.row_number > 1;

-- Ensure canonical URL is stored as TEXT and not nullable
ALTER TABLE "discovered_content"
  ALTER COLUMN "canonical_url" TYPE TEXT,
  ALTER COLUMN "canonical_url" SET NOT NULL;

-- Convert relevance score to floating point with default 0.0
ALTER TABLE "discovered_content"
  ALTER COLUMN "relevance_score" TYPE DOUBLE PRECISION USING "relevance_score"::double precision,
  ALTER COLUMN "relevance_score" SET DEFAULT 0;

-- Add new evidence summary columns
ALTER TABLE "discovered_content"
  ADD COLUMN IF NOT EXISTS "content_hash" TEXT,
  ADD COLUMN IF NOT EXISTS "why_it_matters" TEXT,
  ADD COLUMN IF NOT EXISTS "facts" JSONB,
  ADD COLUMN IF NOT EXISTS "quotes" JSONB,
  ADD COLUMN IF NOT EXISTS "provenance" JSONB,
  ADD COLUMN IF NOT EXISTS "hero" JSONB;

-- Drop legacy canonical URL index if it exists (replaced by unique index)
DROP INDEX IF EXISTS "discovered_content_canonical_url_idx";

-- Enforce uniqueness and add supporting index
CREATE UNIQUE INDEX IF NOT EXISTS "discovered_content_patch_id_canonical_url_key"
  ON "discovered_content" ("patch_id", "canonical_url");
CREATE INDEX IF NOT EXISTS "discovered_content_content_hash_idx"
  ON "discovered_content" ("content_hash");
CREATE INDEX IF NOT EXISTS "discovered_content_canonical_url_idx"
  ON "discovered_content" ("canonical_url");

-- Extend patch metadata to hold entity configuration and whitelisted sources
ALTER TABLE "patches"
  ADD COLUMN IF NOT EXISTS "entity" JSONB,
  ADD COLUMN IF NOT EXISTS "sources_whitelist" JSONB;

