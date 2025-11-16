/**
 * Backfill script for discovered_content.domain column
 * 
 * This script scans all rows where domain IS NULL and derives the domain
 * from the canonicalUrl or sourceUrl columns.
 * 
 * Usage:
 *   pnpm tsx scripts/backfill-discovered-content-domain.ts
 * 
 * Environment:
 *   - DATABASE_URL must be set
 */

import { PrismaClient } from '@prisma/client'
import { getDomainFromUrl } from '../src/lib/discovery/canonicalize'

const prisma = new PrismaClient()

const BATCH_SIZE = 500
const SLEEP_MS = 100 // Small delay between batches to avoid DB pressure

async function backfillDomain() {
  console.log('[Backfill] Starting domain backfill for discovered_content...')
  
  let totalProcessed = 0
  let totalUpdated = 0
  let offset = 0
  let hasMore = true

  while (hasMore) {
    // Fetch a batch of rows with null domain
    const rows = await prisma.discoveredContent.findMany({
      where: {
        domain: null
      },
      select: {
        id: true,
        canonicalUrl: true,
        sourceUrl: true
      },
      take: BATCH_SIZE,
      skip: offset,
      orderBy: {
        createdAt: 'desc'
      }
    })

    if (rows.length === 0) {
      hasMore = false
      break
    }

    console.log(`[Backfill] Processing batch: ${offset} to ${offset + rows.length - 1} (${rows.length} rows)`)

    // Process each row
    const updates: Array<{ id: string; domain: string | null }> = []

    for (const row of rows) {
      // Try to extract domain from canonicalUrl first, then sourceUrl
      const domain = getDomainFromUrl(row.canonicalUrl) ?? getDomainFromUrl(row.sourceUrl) ?? null
      
      if (domain) {
        updates.push({ id: row.id, domain })
      }
    }

    // Batch update - only update domain field
    if (updates.length > 0) {
      for (const { id, domain } of updates) {
        try {
          await prisma.$executeRaw`
            UPDATE discovered_content 
            SET domain = ${domain} 
            WHERE id = ${id}
          `
        } catch (error) {
          console.warn(`[Backfill] Failed to update row ${id}:`, error)
        }
      }
      totalUpdated += updates.length
      console.log(`[Backfill] Updated ${updates.length} rows in this batch`)
    } else {
      console.log(`[Backfill] No valid domains found in this batch`)
    }

    totalProcessed += rows.length
    offset += BATCH_SIZE

    // Small delay to avoid overwhelming the database
    if (hasMore && rows.length === BATCH_SIZE) {
      await new Promise(resolve => setTimeout(resolve, SLEEP_MS))
    }

    // Check if we've reached the end
    if (rows.length < BATCH_SIZE) {
      hasMore = false
    }
  }

  // Final statistics
  const remainingNull = await prisma.discoveredContent.count({
    where: { 
      domain: null
    }
  })

  const totalRows = await prisma.discoveredContent.count()

  console.log('\n[Backfill] Backfill complete!')
  console.log(`[Backfill] Total rows processed: ${totalProcessed}`)
  console.log(`[Backfill] Total rows updated: ${totalUpdated}`)
  console.log(`[Backfill] Rows still with null domain: ${remainingNull}`)
  console.log(`[Backfill] Total rows in table: ${totalRows}`)
  console.log(`[Backfill] Coverage: ${((totalRows - remainingNull) / totalRows * 100).toFixed(2)}%`)

  if (remainingNull > 0) {
    console.warn(`[Backfill] Warning: ${remainingNull} rows still have null domain. These may have invalid URLs.`)
  }
}

async function main() {
  try {
    await backfillDomain()
  } catch (error) {
    console.error('[Backfill] Error during backfill:', error)
    process.exit(1)
  } finally {
    await prisma.$disconnect()
  }
}

main()

