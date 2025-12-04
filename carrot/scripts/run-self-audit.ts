/**
 * Run self-audit for a Wikipedia page
 */

import { prisma } from '../src/lib/prisma'
import { auditWikipediaPageReferences } from '../src/lib/discovery/wikipediaAudit'

function getArg(name: string, defaultValue?: string): string | undefined {
  const arg = process.argv.find(a => a.startsWith(`${name}=`))
  if (arg) {
    return arg.split('=')[1]
  }
  return defaultValue
}

async function main() {
  const patchHandle = getArg('--patch', 'israel') || 'israel'
  const wikipediaTitle = getArg('--wiki-title', 'Zionism') || 'Zionism'

  const patch = await prisma.patch.findUnique({
    where: { handle: patchHandle }
  })

  if (!patch) {
    console.error(`Patch "${patchHandle}" not found`)
    process.exit(1)
  }

  console.log(`\n=== Running Self-Audit ===`)
  console.log(`Patch: ${patchHandle} (${patch.title})`)
  console.log(`Wikipedia Page: ${wikipediaTitle}\n`)

  try {
    const auditResult = await auditWikipediaPageReferences(patch.id, wikipediaTitle)

    console.log(`\n=== Audit Results ===`)
    console.log(`Wikipedia Page: ${auditResult.wikipediaPage}`)
    console.log(`Wikipedia URL: ${auditResult.wikipediaUrl}`)
    console.log(`\nTotal External URLs Found: ${auditResult.totalExternalUrls}`)
    console.log(`Found in Database: ${auditResult.foundInDatabase}`)
    console.log(`Missing from Database: ${auditResult.missingFromDatabase}`)
    
    console.log(`\n--- Status Breakdown ---`)
    console.log(`Pending: ${auditResult.statusBreakdown.pending}`)
    console.log(`Verified: ${auditResult.statusBreakdown.verified}`)
    console.log(`Failed: ${auditResult.statusBreakdown.failed}`)
    console.log(`Saved: ${auditResult.statusBreakdown.saved}`)
    console.log(`Denied: ${auditResult.statusBreakdown.denied}`)

    if (auditResult.missingUrls.length > 0) {
      console.log(`\n--- Missing URLs (first 10) ---`)
      auditResult.missingUrls.slice(0, 10).forEach(url => {
        console.log(`  - ${url}`)
      })
      if (auditResult.missingUrls.length > 10) {
        console.log(`  ... and ${auditResult.missingUrls.length - 10} more`)
      }
    }

    if (auditResult.discrepancies.length > 0) {
      console.log(`\n--- Discrepancies (first 10) ---`)
      auditResult.discrepancies.slice(0, 10).forEach(d => {
        console.log(`  - ${d.url}`)
        console.log(`    Expected: ${d.expectedStatus}`)
        console.log(`    Actual: ${d.actualStatus}`)
      })
      if (auditResult.discrepancies.length > 10) {
        console.log(`  ... and ${auditResult.discrepancies.length - 10} more`)
      }
    }

    // Summary
    console.log(`\n=== Summary ===`)
    const coverageRate = auditResult.totalExternalUrls > 0 
      ? ((auditResult.foundInDatabase / auditResult.totalExternalUrls) * 100).toFixed(1)
      : '0.0'
    console.log(`Coverage Rate: ${coverageRate}% (${auditResult.foundInDatabase}/${auditResult.totalExternalUrls})`)
    
    if (auditResult.missingFromDatabase > 0) {
      console.log(`⚠️  ${auditResult.missingFromDatabase} URLs are missing from database`)
    } else {
      console.log(`✅ All external URLs are in database`)
    }

    if (auditResult.discrepancies.length > 0) {
      console.log(`⚠️  ${auditResult.discrepancies.length} discrepancies found`)
    } else {
      console.log(`✅ No discrepancies found`)
    }

    if (auditResult.statusBreakdown.saved === 0 && auditResult.totalExternalUrls > 0) {
      console.log(`⚠️  No citations have been saved to DiscoveredContent`)
    } else if (auditResult.statusBreakdown.saved > 0) {
      const saveRate = ((auditResult.statusBreakdown.saved / auditResult.totalExternalUrls) * 100).toFixed(1)
      console.log(`✅ ${auditResult.statusBreakdown.saved} citations saved (${saveRate}%)`)
    }

    process.exit(0)
  } catch (error) {
    console.error(`\n❌ Audit failed:`, error)
    process.exit(1)
  }
}

main().catch(e => {
  console.error(e)
  process.exit(1)
})

