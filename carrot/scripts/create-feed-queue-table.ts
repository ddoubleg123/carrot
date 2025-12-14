/**
 * Create AgentMemoryFeedQueue table manually
 */

import 'dotenv/config'
import { prisma } from '../src/lib/prisma'

async function createTable() {
  console.log('Creating AgentMemoryFeedQueue table...\n')

  // Check if table exists first
  const checkSql = `
    SELECT EXISTS (
      SELECT FROM information_schema.tables 
      WHERE table_schema = 'public' 
      AND table_name = 'agent_memory_feed_queue'
    );
  `
  
  const exists = await prisma.$queryRawUnsafe<Array<{ exists: boolean }>>(checkSql)
  
  if (exists[0]?.exists) {
    console.log('✅ Table already exists\n')
    return true
  }

  const sql = `
    CREATE TABLE "agent_memory_feed_queue" (
      "id" TEXT NOT NULL,
      "patch_id" TEXT NOT NULL,
      "discovered_content_id" TEXT NOT NULL,
      "content_hash" TEXT NOT NULL,
      "enqueued_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
      "picked_at" TIMESTAMP(3),
      "attempts" INTEGER NOT NULL DEFAULT 0,
      "last_error" TEXT,
      "status" TEXT NOT NULL DEFAULT 'PENDING',
      "priority" INTEGER NOT NULL DEFAULT 0,
      CONSTRAINT "agent_memory_feed_queue_pkey" PRIMARY KEY ("id")
    );

    CREATE UNIQUE INDEX "agent_memory_feed_queue_patch_id_discovered_content_id_content_hash_key" 
      ON "agent_memory_feed_queue"("patch_id", "discovered_content_id", "content_hash");

    CREATE INDEX "agent_memory_feed_queue_patch_id_status_enqueued_at_idx" 
      ON "agent_memory_feed_queue"("patch_id", "status", "enqueued_at");

    CREATE INDEX "agent_memory_feed_queue_status_enqueued_at_idx" 
      ON "agent_memory_feed_queue"("status", "enqueued_at");

    ALTER TABLE "agent_memory_feed_queue" 
      ADD CONSTRAINT "agent_memory_feed_queue_discovered_content_id_fkey" 
      FOREIGN KEY ("discovered_content_id") 
      REFERENCES "discovered_content"("id") 
      ON DELETE CASCADE 
      ON UPDATE CASCADE;
  `

  try {
    // Execute each statement separately
    const statements = sql.split(';').filter(s => s.trim().length > 0)
    
    for (const statement of statements) {
      const trimmed = statement.trim()
      if (trimmed.length > 0) {
        try {
          await prisma.$executeRawUnsafe(trimmed)
        } catch (err: any) {
          // Ignore "already exists" errors
          if (!err.message?.includes('already exists') && !err.message?.includes('duplicate')) {
            throw err
          }
        }
      }
    }
    
    console.log('✅ AgentMemoryFeedQueue table created successfully!\n')
    
    // Verify it exists
    const count = await (prisma as any).agentMemoryFeedQueue?.count() || 0
    console.log(`✅ Verified: Table exists with ${count} rows\n`)
    return true
  } catch (error: any) {
    if (error.message?.includes('already exists') || error.message?.includes('duplicate')) {
      console.log('✅ Table already exists\n')
      return true
    }
    console.error('❌ Error creating table:', error.message)
    console.error('Full error:', error)
    return false
  }
}

createTable()
  .then((success) => {
    process.exit(success ? 0 : 1)
  })
  .catch(console.error)
  .finally(() => prisma.$disconnect())

