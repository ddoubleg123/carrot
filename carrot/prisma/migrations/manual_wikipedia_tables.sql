-- Manual migration for Wikipedia monitoring tables
-- Run this SQL directly on the database if Prisma migrations fail

-- Create WikipediaMonitoring table
CREATE TABLE IF NOT EXISTS "wikipedia_monitoring" (
    "id" TEXT NOT NULL,
    "patch_id" TEXT NOT NULL,
    "wikipedia_url" TEXT NOT NULL,
    "wikipedia_title" TEXT NOT NULL,
    "search_term" TEXT,
    "content_scanned" BOOLEAN NOT NULL DEFAULT false,
    "content_text" TEXT,
    "last_scanned_at" TIMESTAMP(3),
    "citation_count" INTEGER NOT NULL DEFAULT 0,
    "citations_extracted" BOOLEAN NOT NULL DEFAULT false,
    "last_extracted_at" TIMESTAMP(3),
    "priority" INTEGER NOT NULL DEFAULT 0,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "error_message" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "wikipedia_monitoring_pkey" PRIMARY KEY ("id")
);

-- Create WikipediaCitation table
CREATE TABLE IF NOT EXISTS "wikipedia_citations" (
    "id" TEXT NOT NULL,
    "monitoring_id" TEXT NOT NULL,
    "source_number" INTEGER NOT NULL,
    "citation_url" TEXT NOT NULL,
    "citation_title" TEXT,
    "citation_context" TEXT,
    "ai_priority_score" DOUBLE PRECISION,
    "verification_status" TEXT NOT NULL DEFAULT 'pending',
    "scan_status" TEXT NOT NULL DEFAULT 'not_scanned',
    "relevance_decision" TEXT,
    "saved_content_id" TEXT,
    "saved_memory_id" TEXT UNIQUE,
    "last_verified_at" TIMESTAMP(3),
    "last_scanned_at" TIMESTAMP(3),
    "error_message" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "wikipedia_citations_pkey" PRIMARY KEY ("id")
);

-- Create indexes
CREATE INDEX IF NOT EXISTS "wikipedia_monitoring_patch_id_status_priority_idx" ON "wikipedia_monitoring"("patch_id", "status", "priority");
CREATE INDEX IF NOT EXISTS "wikipedia_monitoring_patch_id_citations_extracted_idx" ON "wikipedia_monitoring"("patch_id", "citations_extracted");
CREATE INDEX IF NOT EXISTS "wikipedia_monitoring_patch_id_last_scanned_at_idx" ON "wikipedia_monitoring"("patch_id", "last_scanned_at");
CREATE INDEX IF NOT EXISTS "wikipedia_citations_monitoring_id_source_number_idx" ON "wikipedia_citations"("monitoring_id", "source_number");
CREATE INDEX IF NOT EXISTS "wikipedia_citations_monitoring_id_verification_status_scan_status_idx" ON "wikipedia_citations"("monitoring_id", "verification_status", "scan_status");
CREATE INDEX IF NOT EXISTS "wikipedia_citations_monitoring_id_ai_priority_score_idx" ON "wikipedia_citations"("monitoring_id", "ai_priority_score");
CREATE INDEX IF NOT EXISTS "wikipedia_citations_verification_status_scan_status_idx" ON "wikipedia_citations"("verification_status", "scan_status");
CREATE INDEX IF NOT EXISTS "wikipedia_citations_citation_url_idx" ON "wikipedia_citations"("citation_url");

-- Create unique constraints
CREATE UNIQUE INDEX IF NOT EXISTS "wikipedia_monitoring_patch_id_wikipedia_url_key" ON "wikipedia_monitoring"("patch_id", "wikipedia_url");
CREATE UNIQUE INDEX IF NOT EXISTS "wikipedia_citations_monitoring_id_source_number_key" ON "wikipedia_citations"("monitoring_id", "source_number");

-- Add foreign key constraints
DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint 
        WHERE conname = 'wikipedia_monitoring_patch_id_fkey'
    ) THEN
        ALTER TABLE "wikipedia_monitoring" 
        ADD CONSTRAINT "wikipedia_monitoring_patch_id_fkey" 
        FOREIGN KEY ("patch_id") REFERENCES "patches"("id") ON DELETE CASCADE ON UPDATE CASCADE;
    END IF;
END $$;

DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint 
        WHERE conname = 'wikipedia_citations_monitoring_id_fkey'
    ) THEN
        ALTER TABLE "wikipedia_citations" 
        ADD CONSTRAINT "wikipedia_citations_monitoring_id_fkey" 
        FOREIGN KEY ("monitoring_id") REFERENCES "wikipedia_monitoring"("id") ON DELETE CASCADE ON UPDATE CASCADE;
    END IF;
END $$;

DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint 
        WHERE conname = 'wikipedia_citations_saved_content_id_fkey'
    ) THEN
        ALTER TABLE "wikipedia_citations" 
        ADD CONSTRAINT "wikipedia_citations_saved_content_id_fkey" 
        FOREIGN KEY ("saved_content_id") REFERENCES "discovered_content"("id") ON DELETE SET NULL ON UPDATE CASCADE;
    END IF;
END $$;

DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint 
        WHERE conname = 'wikipedia_citations_saved_memory_id_fkey'
    ) THEN
        ALTER TABLE "wikipedia_citations" 
        ADD CONSTRAINT "wikipedia_citations_saved_memory_id_fkey" 
        FOREIGN KEY ("saved_memory_id") REFERENCES "agent_memories"("id") ON DELETE SET NULL ON UPDATE CASCADE;
    END IF;
END $$;

