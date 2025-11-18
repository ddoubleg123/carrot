-- CreateTable: crawler_pages
-- Raw page storage for crawler (Phase 1: Foundation)
CREATE TABLE IF NOT EXISTS "crawler_pages" (
    "id" TEXT NOT NULL,
    "url" TEXT NOT NULL,
    "domain" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "first_seen_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "last_processed_at" TIMESTAMP(3),
    "text_hash" TEXT,
    "bytes" INTEGER DEFAULT 0,
    "http_status" INTEGER,
    "reason_code" TEXT,
    "raw_html" TEXT,
    "extracted_text" TEXT,
    "canonical_url" TEXT,

    CONSTRAINT "crawler_pages_pkey" PRIMARY KEY ("id")
);

-- CreateTable: crawler_extractions
-- LLM extraction results (Phase 4: LLM Extractor)
CREATE TABLE IF NOT EXISTS "crawler_extractions" (
    "id" TEXT NOT NULL,
    "page_id" TEXT NOT NULL,
    "topic" TEXT NOT NULL,
    "source_url" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "top_10_facts" JSONB NOT NULL,
    "quoted_passages" JSONB NOT NULL,
    "paraphrase_summary" TEXT NOT NULL,
    "controversial_flags" JSONB,
    "metadata" JSONB NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "crawler_extractions_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "crawler_pages_url_key" ON "crawler_pages"("url");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "crawler_pages_domain_idx" ON "crawler_pages"("domain");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "crawler_pages_status_idx" ON "crawler_pages"("status");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "crawler_pages_text_hash_idx" ON "crawler_pages"("text_hash");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "crawler_pages_first_seen_at_idx" ON "crawler_pages"("first_seen_at");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "crawler_pages_last_processed_at_idx" ON "crawler_pages"("last_processed_at");

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "crawler_extractions_page_id_key" ON "crawler_extractions"("page_id");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "crawler_extractions_topic_idx" ON "crawler_extractions"("topic");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "crawler_extractions_source_url_idx" ON "crawler_extractions"("source_url");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "crawler_extractions_created_at_idx" ON "crawler_extractions"("created_at");

-- AddForeignKey
ALTER TABLE "crawler_extractions" ADD CONSTRAINT "crawler_extractions_page_id_fkey" FOREIGN KEY ("page_id") REFERENCES "crawler_pages"("id") ON DELETE CASCADE ON UPDATE CASCADE;

