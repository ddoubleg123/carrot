/**
 * Add all missing columns to agent_memories table
 */

import 'dotenv/config'
import { prisma } from '../src/lib/prisma'

async function addColumns() {
  console.log('Adding missing columns to agent_memories table...\n')

  const columns = [
    { name: 'patch_id', type: 'TEXT' },
    { name: 'discovered_content_id', type: 'TEXT' },
    { name: 'content_hash', type: 'TEXT' },
    { name: 'summary', type: 'TEXT' },
    { name: 'facts', type: 'JSONB' },
    { name: 'entities', type: 'JSONB' },
    { name: 'timeline', type: 'JSONB' },
    { name: 'raw_text_ptr', type: 'TEXT' }
  ]

  try {
    for (const col of columns) {
      // Check if column exists
      const checkSql = `
        SELECT column_name 
        FROM information_schema.columns 
        WHERE table_name = 'agent_memories' 
        AND column_name = $1;
      `
      
      const exists = await prisma.$queryRawUnsafe<Array<{ column_name: string }>>(
        checkSql,
        col.name
      )
      
      if (exists.length > 0) {
        console.log(`⏭️  Column ${col.name} already exists`)
        continue
      }

      // Add the column
      const addColumnSql = `
        ALTER TABLE agent_memories 
        ADD COLUMN ${col.name} ${col.type};
      `

      await prisma.$executeRawUnsafe(addColumnSql)
      console.log(`✅ Added ${col.name} column`)
    }

    console.log('\n✅ All columns added successfully!\n')
    return true
  } catch (error: any) {
    console.error('❌ Error adding columns:', error.message)
    return false
  }
}

addColumns()
  .then((success) => {
    process.exit(success ? 0 : 1)
  })
  .catch(console.error)
  .finally(() => prisma.$disconnect())

