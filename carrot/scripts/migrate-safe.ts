/**
 * Migration safety wrapper
 * Provides compat window: deploy Prisma client first, then run Migration 1, then code using new fields
 * Gate Migration 2 behind one-shot script that asserts status IS NOT NULL across table before applying
 */

import { PrismaClient } from '@prisma/client'
import { execSync } from 'child_process'

const prisma = new PrismaClient()

/**
 * Assert that all records in a table have a non-null status field
 * Used before applying Migration 2
 */
async function assertStatusNotNull(tableName: string): Promise<void> {
  console.log(`[Migration Safety] Checking ${tableName} for null status values...`)
  
  // Use raw query to check for null status
  const result = await prisma.$queryRawUnsafe<Array<{ count: bigint }>>(
    `SELECT COUNT(*) as count FROM ${tableName} WHERE status IS NULL`
  )
  
  const nullCount = Number(result[0]?.count || 0)
  
  if (nullCount > 0) {
    throw new Error(
      `Migration safety check failed: ${nullCount} records in ${tableName} have null status. ` +
      `Please backfill status values before applying Migration 2.`
    )
  }
  
  console.log(`[Migration Safety] ✅ All records in ${tableName} have non-null status`)
}

/**
 * Run migration with safety checks
 */
async function runMigrationSafely(migrationName: string, requiresStatusCheck = false) {
  console.log(`[Migration Safety] Starting migration: ${migrationName}`)
  
  try {
    // Step 1: Generate Prisma client (always do this first)
    console.log('[Migration Safety] Step 1: Generating Prisma client...')
    execSync('npx prisma generate', { stdio: 'inherit' })
    console.log('[Migration Safety] ✅ Prisma client generated')
    
    // Step 2: If this is Migration 2, check status field
    if (requiresStatusCheck) {
      console.log('[Migration Safety] Step 2: Running status check...')
      await assertStatusNotNull('heroes') // Adjust table name as needed
      console.log('[Migration Safety] ✅ Status check passed')
    }
    
    // Step 3: Run migration
    console.log(`[Migration Safety] Step 3: Running migration: ${migrationName}...`)
    execSync(`npx prisma migrate deploy --name ${migrationName}`, { stdio: 'inherit' })
    console.log(`[Migration Safety] ✅ Migration ${migrationName} completed successfully`)
    
  } catch (error) {
    console.error(`[Migration Safety] ❌ Migration ${migrationName} failed:`, error)
    process.exit(1)
  } finally {
    await prisma.$disconnect()
  }
}

// CLI usage
const migrationName = process.argv[2]
const requiresStatusCheck = process.argv[3] === '--check-status'

if (!migrationName) {
  console.error('Usage: tsx scripts/migrate-safe.ts <migration-name> [--check-status]')
  process.exit(1)
}

runMigrationSafely(migrationName, requiresStatusCheck).catch(console.error)

