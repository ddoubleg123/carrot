-- Add indexes for discovery performance
-- Migration: 20250124000000_add_discovery_indexes

-- Index for patchId + createdAt (for cursor pagination and sorting)
CREATE INDEX IF NOT EXISTS "discovered_content_patch_id_created_at_idx" ON "discovered_content"("patch_id", "created_at");

-- Note: heroRecord is a relation field (not a scalar), so it cannot be indexed directly.
-- The WHERE clause "heroRecord IS NULL" in sync-heroes queries will use:
-- 1. The existing index on Hero.contentId (unique index)
-- 2. The patchId index for filtering by patch
-- This combination is sufficient for efficient queries.

