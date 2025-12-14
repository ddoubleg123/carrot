/**
 * Add patchId column to agent_memories table
 */

import 'dotenv/config'
import { prisma } from '../src/lib/prisma'

async function addColumn() {
  console.log('Adding patch_id column to agent_memories table...\n')

  try {
    // Check if column exists
    const checkSql = `
      SELECT column_name 
      FROM information_schema.columns 
      WHERE table_name = 'agent_memories' 
      AND column_name = 'patch_id';
    `
    
    const exists = await prisma.$queryRawUnsafe<Array<{ column_name: string }>>(checkSql)
    
    if (exists.length > 0) {
      console.log('✅ Column patch_id already exists\n')
      return true
    }

    // Add the column
    const addColumnSql = `
      ALTER TABLE agent_memories 
      ADD COLUMN patch_id TEXT;
    `

    await prisma.$executeRawUnsafe(addColumnSql)
    console.log('✅ Added patch_id column\n')

    // Add indexes if they don't exist
    try {
      await prisma.$executeRawUnsafe(`
        CREATE INDEX IF NOT EXISTS agent_memories_patch_id_discovered_content_id_idx 
        ON agent_memories(patch_id, discovered_content_id);
      `)
      console.log('✅ Added index on (patch_id, discovered_content_id)\n')
    } catch (err: any) {
      if (!err.message?.includes('already exists')) {
        console.warn('⚠️  Could not create index:', err.message)
      }
    }

    return true
  } catch (error: any) {
    console.error('❌ Error adding column:', error.message)
    return false
  }
}

addColumn()
  .then((success) => {
    process.exit(success ? 0 : 1)
  })
  .catch(console.error)
  .finally(() => prisma.$disconnect())

