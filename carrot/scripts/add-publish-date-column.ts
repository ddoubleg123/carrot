/**
 * Add publish_date column to discovered_content table
 * Run with: npx tsx scripts/add-publish-date-column.ts
 */

import { prisma } from '../src/lib/prisma'
import * as fs from 'fs'
import * as path from 'path'

async function addPublishDateColumn() {
  console.log('Adding publish_date column to discovered_content...\n')

  try {
    const sql = fs.readFileSync(
      path.join(__dirname, '../prisma/migrations/manual_add_publish_date.sql'),
      'utf-8'
    )

    // Execute the SQL
    await prisma.$executeRawUnsafe(sql)
    console.log('✅ Migration applied successfully!\n')

    // Verify the column exists
    const result = await prisma.$queryRawUnsafe<Array<{ column_name: string }>>(
      `SELECT column_name 
       FROM information_schema.columns 
       WHERE table_schema = 'public' 
       AND table_name = 'discovered_content' 
       AND column_name = 'publish_date'`
    )

    if (result.length > 0) {
      console.log('✅ Verified: publish_date column exists in discovered_content table')
    } else {
      console.log('⚠️  Warning: Column not found after migration')
    }

    process.exit(0)
  } catch (error: any) {
    console.error('❌ Migration failed:', error.message)
    if (error.message?.includes('already exists')) {
      console.log('ℹ️  Column may already exist - this is OK')
      process.exit(0)
    }
    process.exit(1)
  } finally {
    await prisma.$disconnect()
  }
}

addPublishDateColumn().catch(console.error)

