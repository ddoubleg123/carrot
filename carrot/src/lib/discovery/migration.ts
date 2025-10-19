/**
 * Database Migration Script for Enhanced Discovery System
 * 
 * Adds new fields to DiscoveredContent model for:
 * - Content hash fingerprinting (SimHash)
 * - Domain tracking for diversity
 * - Unique constraints for deduplication
 */

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

export async function migrateDiscoverySchema() {
  console.log('🔄 Starting discovery schema migration...');
  
  try {
    // Add new fields to DiscoveredContent table
    console.log('📝 Adding new fields to DiscoveredContent...');
    
    // Add contentHash field for SimHash fingerprinting
    await prisma.$executeRaw`
      ALTER TABLE DiscoveredContent ADD COLUMN contentHash TEXT;
    `;
    
    // Add domain field for diversity tracking
    await prisma.$executeRaw`
      ALTER TABLE DiscoveredContent ADD COLUMN domain TEXT;
    `;
    
    // Create unique index for (patchId, canonicalUrl) deduplication
    await prisma.$executeRaw`
      CREATE UNIQUE INDEX IF NOT EXISTS idx_discovered_content_patch_canonical 
      ON DiscoveredContent(patchId, canonicalUrl);
    `;
    
    // Create unique index for canonicalUrl (app-wide deduplication)
    await prisma.$executeRaw`
      CREATE UNIQUE INDEX IF NOT EXISTS idx_discovered_content_canonical 
      ON DiscoveredContent(canonicalUrl);
    `;
    
    // Create index for contentHash for near-duplicate detection
    await prisma.$executeRaw`
      CREATE INDEX IF NOT EXISTS idx_discovered_content_hash 
      ON DiscoveredContent(contentHash);
    `;
    
    // Create index for domain for diversity tracking
    await prisma.$executeRaw`
      CREATE INDEX IF NOT EXISTS idx_discovered_content_domain 
      ON DiscoveredContent(domain);
    `;
    
    // Create index for createdAt for recency tracking
    await prisma.$executeRaw`
      CREATE INDEX IF NOT EXISTS idx_discovered_content_created 
      ON DiscoveredContent(createdAt);
    `;
    
    console.log('✅ DiscoveredContent fields added successfully');
    
    // Create DiscoveryCursor table for search frontier
    console.log('📝 Creating DiscoveryCursor table...');
    
    await prisma.$executeRaw`
      CREATE TABLE IF NOT EXISTS DiscoveryCursor (
        id TEXT PRIMARY KEY,
        patchId TEXT NOT NULL,
        source TEXT NOT NULL,
        nextToken TEXT,
        lastHitAt DATETIME DEFAULT CURRENT_TIMESTAMP,
        duplicateHitRate REAL DEFAULT 0.0,
        priority REAL DEFAULT 1.0,
        createdAt DATETIME DEFAULT CURRENT_TIMESTAMP,
        updatedAt DATETIME DEFAULT CURRENT_TIMESTAMP,
        UNIQUE(patchId, source)
      );
    `;
    
    // Create indexes for DiscoveryCursor
    await prisma.$executeRaw`
      CREATE INDEX IF NOT EXISTS idx_discovery_cursor_priority 
      ON DiscoveryCursor(priority);
    `;
    
    await prisma.$executeRaw`
      CREATE INDEX IF NOT EXISTS idx_discovery_cursor_last_hit 
      ON DiscoveryCursor(lastHitAt);
    `;
    
    console.log('✅ DiscoveryCursor table created successfully');
    
    // Create RejectedContent table for tracking rejected items
    console.log('📝 Creating RejectedContent table...');
    
    await prisma.$executeRaw`
      CREATE TABLE IF NOT EXISTS RejectedContent (
        id TEXT PRIMARY KEY,
        patchId TEXT NOT NULL,
        url TEXT NOT NULL,
        reason TEXT NOT NULL,
        contentHash TEXT,
        rejectedAt DATETIME DEFAULT CURRENT_TIMESTAMP,
        UNIQUE(patchId, url)
      );
    `;
    
    // Create indexes for RejectedContent
    await prisma.$executeRaw`
      CREATE INDEX IF NOT EXISTS idx_rejected_content_hash 
      ON RejectedContent(contentHash);
    `;
    
    await prisma.$executeRaw`
      CREATE INDEX IF NOT EXISTS idx_rejected_content_rejected 
      ON RejectedContent(rejectedAt);
    `;
    
    console.log('✅ RejectedContent table created successfully');
    
    console.log('🎉 Discovery schema migration completed successfully!');
    
  } catch (error) {
    console.error('❌ Migration failed:', error);
    throw error;
  } finally {
    await prisma.$disconnect();
  }
}

// Run migration if called directly
if (require.main === module) {
  migrateDiscoverySchema()
    .then(() => {
      console.log('✅ Migration completed');
      process.exit(0);
    })
    .catch((error) => {
      console.error('❌ Migration failed:', error);
      process.exit(1);
    });
}
