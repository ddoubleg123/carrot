ALTER TABLE "posts" ADD COLUMN IF NOT EXISTS "bucket" TEXT;
ALTER TABLE "posts" ADD COLUMN IF NOT EXISTS "patchId" TEXT;
CREATE INDEX IF NOT EXISTS "posts_bucket_idx" ON "posts"("bucket");
CREATE INDEX IF NOT EXISTS "posts_patchId_idx" ON "posts"("patchId");

CREATE TABLE IF NOT EXISTS "feed_rank" (
  "id" TEXT PRIMARY KEY,
  "data" JSONB NOT NULL,
  "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);
