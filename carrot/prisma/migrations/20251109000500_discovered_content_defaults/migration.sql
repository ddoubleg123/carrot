UPDATE "discovered_content"
SET "quality_score" = 0
WHERE "quality_score" IS NULL;

UPDATE "discovered_content"
SET "relevance_score" = 0
WHERE "relevance_score" IS NULL;

ALTER TABLE "discovered_content"
  ALTER COLUMN "quality_score" SET DEFAULT 0,
  ALTER COLUMN "quality_score" SET NOT NULL,
  ALTER COLUMN "relevance_score" SET DEFAULT 0,
  ALTER COLUMN "relevance_score" SET NOT NULL;
