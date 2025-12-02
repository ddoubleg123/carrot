/**
 * Reset Incorrectly Completed Pages Script
 * 
 * This script finds Wikipedia pages that were marked as "completed" but still
 * have unprocessed citations, and resets them to "scanning" status so they
 * can be processed again.
 * 
 * A citation is considered "unprocessed" if:
 * - scanStatus != 'scanned' AND verificationStatus != 'failed'
 * 
 * Usage: npx tsx scripts/reset-incorrectly-completed-pages.ts [patchHandle] [--dry-run]
 * Example: npx tsx scripts/reset-incorrectly-completed-pages.ts chicago-bulls
 * Example: npx tsx scripts/reset-incorrectly-completed-pages.ts chicago-bulls --dry-run
 */

import { prisma } from '../src/lib/prisma'

async function resetIncorrectlyCompletedPages(patchHandle: string, dryRun: boolean) {
  console.log(`\n🔧 Reset Incorrectly Completed Pages: ${patchHandle}\n`)
  if (dryRun) {
    console.log('⚠️  DRY RUN MODE - No changes will be made\n')
  }

  try {
    const patch = await prisma.patch.findUnique({
      where: { handle: patchHandle },
      select: { id: true, title: true }
    })

    if (!patch) {
      console.error(`❌ Error: Patch with handle "${patchHandle}" not found.`)
      process.exit(1)
    }

    console.log(`📋 Patch: ${patch.title} (${patch.id})\n`)
    console.log('='.repeat(70))

    // Find completed pages with unprocessed citations
    // A citation is unprocessed if it's NOT scanned AND verification didn't fail
    const incorrectlyCompletedPages = await prisma.wikipediaMonitoring.findMany({
      where: {
        patchId: patch.id,
        status: 'completed',
        citationsExtracted: true,
        citations: {
          some: {
            AND: [
              { scanStatus: { not: 'scanned' } },
              { verificationStatus: { not: 'failed' } }
            ]
          }
        }
      },
      select: {
        id: true,
        wikipediaTitle: true,
        status: true,
        citationCount: true,
        _count: {
          select: {
            citations: {
              where: {
                AND: [
                  { scanStatus: { not: 'scanned' } },
                  { verificationStatus: { not: 'failed' } }
                ]
              }
            }
          }
        }
      },
      orderBy: [
        { priority: 'desc' },
        { createdAt: 'asc' }
      ]
    })

    console.log(`\nFound ${incorrectlyCompletedPages.length} incorrectly completed pages:\n`)

    if (incorrectlyCompletedPages.length === 0) {
      console.log('✅ No incorrectly completed pages found. All pages are correctly marked.')
      process.exit(0)
    }

    let resetCount = 0
    for (const page of incorrectlyCompletedPages) {
      console.log(`📄 "${page.wikipediaTitle}"`)
      console.log(`   Status: ${page.status}`)
      console.log(`   Total citations: ${page.citationCount}`)
      console.log(`   Unprocessed citations: ${page._count.citations}`)
      console.log(`   → Will reset to 'scanning' status\n`)

      if (!dryRun) {
        await prisma.wikipediaMonitoring.update({
          where: { id: page.id },
          data: { status: 'scanning' }
        })
        resetCount++
        console.log(`   ✅ Reset to 'scanning' status\n`)
      }
    }

    console.log('='.repeat(70))
    console.log('\n📊 Summary\n')
    console.log(`Total incorrectly completed pages: ${incorrectlyCompletedPages.length}`)
    if (dryRun) {
      console.log(`Would reset: ${incorrectlyCompletedPages.length} pages`)
      console.log('\n💡 Run without --dry-run to actually reset these pages')
    } else {
      console.log(`Reset: ${resetCount} pages`)
      console.log('\n✅ Pages have been reset. They will be processed on the next discovery run.')
    }

    process.exit(0)

  } catch (error: any) {
    console.error(`❌ Error:`, error.message)
    console.error(error)
    process.exit(1)
  } finally {
    await prisma.$disconnect()
  }
}

const patchHandle = process.argv[2]
const dryRun = process.argv.includes('--dry-run')

if (!patchHandle) {
  console.error('Usage: npx tsx scripts/reset-incorrectly-completed-pages.ts [patchHandle] [--dry-run]')
  process.exit(1)
}

resetIncorrectlyCompletedPages(patchHandle, dryRun).catch(console.error)

