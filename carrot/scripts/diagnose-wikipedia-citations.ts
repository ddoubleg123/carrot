/**
 * Diagnostic script to check why citations aren't being extracted
 * and optionally reset pages for re-processing
 */

import { prisma } from '../src/lib/prisma'

async function diagnose() {
  console.log('🔍 Wikipedia Citation Extraction Diagnostic\n')

  try {
    // Find a patch with Wikipedia monitoring
    const patch = await prisma.patch.findFirst({
      where: {
        wikipediaMonitoring: {
          some: {}
        }
      },
      select: {
        id: true,
        handle: true,
        title: true
      }
    })

    if (!patch) {
      console.log('❌ No patches with Wikipedia monitoring found')
      process.exit(1)
    }

    console.log(`📋 Patch: ${patch.handle} (${patch.title})\n`)

    // Check pages
    const pages = await prisma.wikipediaMonitoring.findMany({
      where: { patchId: patch.id },
      select: {
        id: true,
        wikipediaTitle: true,
        status: true,
        contentScanned: true,
        citationsExtracted: true,
        citationCount: true,
        _count: {
          select: {
            citations: true
          }
        }
      }
    })

    console.log(`📄 Found ${pages.length} Wikipedia pages\n`)

    let pagesWithNoCitations = 0
    let pagesMarkedCompleteButNoCitations = 0

    for (const page of pages) {
      const actualCitationCount = page._count.citations
      const reportedCount = page.citationCount

      if (actualCitationCount === 0) {
        pagesWithNoCitations++
        console.log(`❌ "${page.wikipediaTitle}":`)
        console.log(`   Status: ${page.status}`)
        console.log(`   Content scanned: ${page.contentScanned}`)
        console.log(`   Citations extracted: ${page.citationsExtracted}`)
        console.log(`   Reported citation count: ${reportedCount}`)
        console.log(`   Actual citations in DB: ${actualCitationCount}`)
        
        if (page.status === 'completed' && actualCitationCount === 0) {
          pagesMarkedCompleteButNoCitations++
          console.log(`   ⚠️  MARKED COMPLETE BUT NO CITATIONS EXTRACTED!`)
        }
        console.log('')
      }
    }

    console.log('\n============================================================\n')
    console.log('📊 Summary\n')
    console.log(`Total pages: ${pages.length}`)
    console.log(`Pages with no citations: ${pagesWithNoCitations}`)
    console.log(`Pages marked complete but no citations: ${pagesMarkedCompleteButNoCitations}\n`)

    if (pagesMarkedCompleteButNoCitations > 0) {
      console.log('💡 Recommendation: Reset these pages to "pending" status for re-processing')
      console.log('   Run with --reset flag to automatically reset them\n')
    }

    process.exit(0)
  } catch (error: any) {
    console.error('❌ Diagnostic failed:', error.message)
    process.exit(1)
  } finally {
    await prisma.$disconnect()
  }
}

async function resetPages() {
  console.log('🔄 Resetting pages marked complete but with no citations...\n')

  try {
    // Find pages that are marked complete but have no citations
    const pagesToReset = await prisma.wikipediaMonitoring.findMany({
      where: {
        status: 'completed',
        citations: {
          none: {}
        }
      },
      select: {
        id: true,
        wikipediaTitle: true,
        patchId: true
      }
    })

    console.log(`Found ${pagesToReset.length} pages to reset\n`)

    for (const page of pagesToReset) {
      await prisma.wikipediaMonitoring.update({
        where: { id: page.id },
        data: {
          status: 'pending',
          contentScanned: false,
          citationsExtracted: false,
          citationCount: 0,
          errorMessage: null
        }
      })
      console.log(`✅ Reset: "${page.wikipediaTitle}"`)
    }

    console.log(`\n✅ Reset ${pagesToReset.length} pages. They will be re-processed on next discovery run.`)
    process.exit(0)
  } catch (error: any) {
    console.error('❌ Reset failed:', error.message)
    process.exit(1)
  } finally {
    await prisma.$disconnect()
  }
}

const shouldReset = process.argv.includes('--reset')

if (shouldReset) {
  resetPages()
} else {
  diagnose()
}

