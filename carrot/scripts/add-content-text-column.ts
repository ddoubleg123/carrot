/**
 * Add content_text column to wikipedia_citations table
 * Run with: npx tsx scripts/add-content-text-column.ts
 */

import { prisma } from '../src/lib/prisma'

async function addContentTextColumn() {
  console.log('Adding content_text column to wikipedia_citations...\n')

  try {
    // Check if the column already exists
    const columnExists = await prisma.$queryRawUnsafe<Array<{ column_name: string }>>(
      `SELECT column_name
       FROM information_schema.columns
       WHERE table_schema = 'public'
       AND table_name = 'wikipedia_citations'
       AND column_name = 'content_text';`
    )

    if (columnExists.length > 0) {
      console.log('✅ content_text column already exists in wikipedia_citations. Skipping migration.')
    } else {
      // Add the column
      await prisma.$executeRawUnsafe(`
        ALTER TABLE "public"."wikipedia_citations"
        ADD COLUMN "content_text" TEXT;
      `)
      console.log('✅ content_text column added to wikipedia_citations successfully.')
    }

    // Verify the column exists after the operation
    const verifyColumn = await prisma.$queryRawUnsafe<Array<{ column_name: string }>>(
      `SELECT column_name
       FROM information_schema.columns
       WHERE table_schema = 'public'
       AND table_name = 'wikipedia_citations'
       AND column_name = 'content_text';`
    )

    if (verifyColumn.length > 0) {
      console.log('✅ Verified: content_text column exists in wikipedia_citations table')
    } else {
      console.error('❌ Verification failed: content_text column does NOT exist in wikipedia_citations table')
      process.exit(1)
    }

  } catch (error: any) {
    console.error('❌ Error adding content_text column:', error.message)
    if (error.message?.includes('already exists')) {
      console.log('ℹ️  Column may already exist - this is OK')
      process.exit(0)
    }
    process.exit(1)
  } finally {
    await prisma.$disconnect()
  }
}

addContentTextColumn().catch(console.error)

