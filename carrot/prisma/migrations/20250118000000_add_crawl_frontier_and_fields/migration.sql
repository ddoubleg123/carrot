-- AlterTable: Add new fields to discovered_content
ALTER TABLE "discovered_content" ADD COLUMN IF NOT EXISTS "source_domain" VARCHAR(255);
ALTER TABLE "discovered_content" ADD COLUMN IF NOT EXISTS "raw_html" BYTEA;
ALTER TABLE "discovered_content" ADD COLUMN IF NOT EXISTS "text_content" TEXT;
ALTER TABLE "discovered_content" ADD COLUMN IF NOT EXISTS "key_facts" JSONB;
ALTER TABLE "discovered_content" ADD COLUMN IF NOT EXISTS "notable_quotes" JSONB;
ALTER TABLE "discovered_content" ADD COLUMN IF NOT EXISTS "is_useful" BOOLEAN;
ALTER TABLE "discovered_content" ADD COLUMN IF NOT EXISTS "last_crawled_at" TIMESTAMP(3);

-- CreateIndex: Add index on source_domain
CREATE INDEX IF NOT EXISTS "discovered_content_source_domain_idx" ON "discovered_content"("source_domain");

-- CreateIndex: Add index on last_crawled_at
CREATE INDEX IF NOT EXISTS "discovered_content_last_crawled_at_idx" ON "discovered_content"("last_crawled_at");

-- CreateTable: CrawlFrontier for durable dedupe
CREATE TABLE IF NOT EXISTS "crawl_frontier" (
    "url" TEXT NOT NULL,
    "source" TEXT,
    "first_seen_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "last_tried_at" TIMESTAMP(3),
    "status" TEXT NOT NULL DEFAULT 'pending',
    "fail_reason" TEXT,
    "depth" INTEGER NOT NULL DEFAULT 0,
    "parent_url" TEXT,
    "normalized_url" TEXT NOT NULL,
    "retry_count" INTEGER NOT NULL DEFAULT 0,
    "robots_allowed" BOOLEAN,
    "http_status" INTEGER,
    "content_type" VARCHAR(255),
    "title" TEXT,
    "sha256" VARCHAR(64),

    CONSTRAINT "crawl_frontier_pkey" PRIMARY KEY ("url")
);

-- CreateIndex: Add indexes for crawl_frontier
CREATE UNIQUE INDEX IF NOT EXISTS "crawl_frontier_normalized_url_key" ON "crawl_frontier"("normalized_url");
CREATE INDEX IF NOT EXISTS "crawl_frontier_status_last_tried_at_idx" ON "crawl_frontier"("status", "last_tried_at");
CREATE INDEX IF NOT EXISTS "crawl_frontier_depth_idx" ON "crawl_frontier"("depth");
CREATE INDEX IF NOT EXISTS "crawl_frontier_normalized_url_idx" ON "crawl_frontier"("normalized_url");

